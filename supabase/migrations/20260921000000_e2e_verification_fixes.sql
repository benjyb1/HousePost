-- Fixes found by the end-to-end verification pass (see PR).
--
-- 1. Suppression matching: store a second, coarser "premises" key alongside the
--    full address key so an opt-out that omits the locality/town still matches
--    the Land Registry address (which always carries "…, Locality, Town").
--    The key is built by lib/address/normalise.ts:premisesKey() on both sides.
-- 2. Sign-up: the confirm-email path never wrote company_name / office_postcode
--    to the profile (they only arrived as auth metadata). Copy them in the
--    trigger so a confirmed user lands with a usable profile.
-- 3. Custom-design briefs: assets were uploaded into the PUBLIC postcard-designs
--    bucket. Give them a private bucket with per-user-folder RLS; the app reads
--    them back via short-lived signed URLs.

-- 1. Premises key on the suppression list -------------------------------------
ALTER TABLE suppression_list
  ADD COLUMN IF NOT EXISTS premises_key TEXT;

CREATE INDEX IF NOT EXISTS idx_suppression_premises_key
  ON suppression_list(premises_key)
  WHERE premises_key IS NOT NULL;

-- 2. Sign-up trigger keeps the office postcode and company name ---------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, company_name, office_postcode)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
    COALESCE(UPPER(TRIM(NEW.raw_user_meta_data->>'office_postcode')), '')
  );
  RETURN NEW;
END;
$function$;

-- 3. Private bucket for custom-design brief assets ------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('design-request-assets', 'design-request-assets', false, 15728640)
  ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

-- Owner can upload into, read from, and tidy their own folder. The service role
-- (used by the API route and the team's tooling) bypasses RLS.
DROP POLICY IF EXISTS "Users upload own design-request assets" ON storage.objects;
CREATE POLICY "Users upload own design-request assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'design-request-assets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users read own design-request assets" ON storage.objects;
CREATE POLICY "Users read own design-request assets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'design-request-assets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own design-request assets" ON storage.objects;
CREATE POLICY "Users delete own design-request assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'design-request-assets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4. Re-send unwinds ------------------------------------------------------------
-- "Send again" now claims a previously-sent lead at CONFIRM time (the lead keeps
-- its link to the old job until the new order exists). When that new order is
-- cancelled, or fails to post, the lead must go back to pointing at its most
-- recent finished job — not be left orphaned in "New leads" with no trace of
-- the card that was already sent. Scoped to p_job_id so a concurrent claim by a
-- different order is never overwritten.
CREATE OR REPLACE FUNCTION relink_lead_after_unwind(p_lead_id uuid, p_job_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE leads
     SET postcard_job_id = (
           SELECT id
             FROM postcard_jobs
            WHERE lead_id = p_lead_id
              AND id <> p_job_id
              AND status NOT IN ('pending', 'held', 'dispatching', 'cancelled', 'failed')
            ORDER BY created_at DESC
            LIMIT 1
         ),
         selected_for_dispatch = false
   WHERE id = p_lead_id
     AND postcard_job_id = p_job_id;
$$;

REVOKE EXECUTE ON FUNCTION relink_lead_after_unwind(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION relink_lead_after_unwind(uuid, uuid) TO service_role;
