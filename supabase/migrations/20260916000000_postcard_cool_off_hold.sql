-- Postcard cool-off / held-order pipeline (features 6.3, 6.4, 8.6).
--
-- Before this change a confirmed send went straight to Stannp and overage was
-- metered at period end. We now:
--   * charge the saved card up front (stored in the existing
--     stripe_payment_intent_id column — a real PaymentIntent id now, rather than
--     a meter-event id),
--   * hold the order for POSTCARD_COOL_OFF_MINUTES with a release_at timestamp,
--   * let a cron dispatch held orders once release_at passes,
--   * let the user cancel (and be refunded) before release_at,
--   * enforce a hard MONTHLY_POSTCARD_CAP at the database level.
--
-- All columns are additive and nullable, so this is safe to apply to the
-- populated postcard_jobs table. Existing rows keep release_at = NULL and
-- batch_id = NULL and are ignored by the release cron (which only ever looks at
-- status = 'held').

-- 1. Held-order columns ------------------------------------------------------

ALTER TABLE postcard_jobs
  ADD COLUMN IF NOT EXISTS release_at TIMESTAMPTZ,
  -- Groups every job created by a single "send" so the UI can cancel the whole
  -- order and so the up-front charge (one PaymentIntent per send) can be found
  -- again for a refund. NULL for all historical rows.
  ADD COLUMN IF NOT EXISTS batch_id UUID,
  -- Set when the release cron claims a row for dispatch, so a row stuck in
  -- 'dispatching' (a crash mid-send) can be detected and alerted on.
  ADD COLUMN IF NOT EXISTS dispatching_at TIMESTAMPTZ,
  -- Design snapshot taken at hold time, so a design change (or removal) during
  -- the cool-off can't alter or break what actually prints versus what the user
  -- previewed. The release cron prints from these, not the live profile.
  ADD COLUMN IF NOT EXISTS held_design_front_url TEXT,
  ADD COLUMN IF NOT EXISTS held_design_back_url TEXT;

-- 2. New statuses ------------------------------------------------------------
--
-- 'held'        — charged, waiting out the cool-off; cancellable.
-- 'dispatching' — the release cron has atomically claimed the row and is calling
--                 Stannp. This transient state is what makes cancel-vs-release
--                 race-safe: cancel only ever touches 'held' rows, so once the
--                 cron flips a row to 'dispatching' it can no longer be cancelled
--                 and can therefore never be both posted and refunded.
--
-- The original CHECK constraint was created inline and is auto-named
-- postcard_jobs_status_check. Drop and recreate it to widen the allowed set.

ALTER TABLE postcard_jobs
  DROP CONSTRAINT IF EXISTS postcard_jobs_status_check;

ALTER TABLE postcard_jobs
  ADD CONSTRAINT postcard_jobs_status_check
  CHECK (status IN ('pending','dispatched','failed','cancelled','held','dispatching'));

-- 3. Index for the release cron ---------------------------------------------
-- The cron repeatedly asks "which held orders are now due?"; a partial index
-- keeps that cheap and never touches the (far larger) set of finished jobs.

CREATE INDEX IF NOT EXISTS idx_pj_release_due
  ON postcard_jobs (release_at)
  WHERE status = 'held';

-- Cancel and the UI both look orders up by batch.
CREATE INDEX IF NOT EXISTS idx_pj_batch ON postcard_jobs (batch_id)
  WHERE batch_id IS NOT NULL;

-- 4. Capped, atomic usage increment (feature 6.3) ----------------------------
-- Reserves p_amount postcards against the period counter ONLY if doing so keeps
-- the user at or below p_cap. Returns the PRE-increment counter value on success
-- (so the caller can split included vs paid deterministically without a second,
-- racy read) and -1 when the reservation is refused because it would breach the
-- cap. The FOR UPDATE row lock serialises concurrent sends, making the cap a
-- hard database-level stop rather than a best-effort application check.

CREATE OR REPLACE FUNCTION increment_postcards_used_capped(
  p_user_id uuid,
  p_amount int,
  p_cap int
) RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_used int;
BEGIN
  SELECT COALESCE(postcards_used_this_period, 0)
    INTO v_used
    FROM profiles
   WHERE id = p_user_id
   FOR UPDATE;

  -- No such profile, or the reservation would exceed the cap: reserve nothing.
  IF v_used IS NULL OR v_used + p_amount > p_cap THEN
    RETURN -1;
  END IF;

  UPDATE profiles
     SET postcards_used_this_period = v_used + p_amount
   WHERE id = p_user_id;

  RETURN v_used;
END;
$$;

-- 5. Safe decrement ----------------------------------------------------------
-- Used when a charge fails or a held order is cancelled, to hand the reserved
-- allowance back. Clamped at 0 so a stray double-call can never drive the
-- counter negative (which would silently hand out extra free postcards).

CREATE OR REPLACE FUNCTION decrement_postcards_used(
  p_user_id uuid,
  p_amount int
) RETURNS void
LANGUAGE sql
AS $$
  UPDATE profiles
     SET postcards_used_this_period =
           GREATEST(0, COALESCE(postcards_used_this_period, 0) - p_amount)
   WHERE id = p_user_id;
$$;
