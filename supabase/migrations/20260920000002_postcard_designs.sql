-- Saved postcard design LIBRARY (design preview + library feature).
--
-- Background: `profiles.postcard_design_url` (front) and
-- `profiles.postcard_design_back_url` (back) hold the single ACTIVE design that
-- the send pipeline reads. Those pointers are unchanged by this migration.
--
-- This table is a per-user library of designs the customer has made/uploaded, so
-- they can keep several and switch the active one from a dropdown. Each row is a
-- snapshot: a front image (always) and an optional back image. Setting a library
-- row "active" simply copies its urls back onto the profile pointers.
--
-- NOT APPLIED to any database yet — review before running. The owner applies
-- migrations. See PR/report.

CREATE TABLE postcard_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The owning user. Cascade-delete with the profile: a saved design is a
  -- convenience artefact, not a financial record, so it goes with the account.
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Human-friendly auto label, e.g. "Bold template · 15 Sep".
  label TEXT NOT NULL,

  -- How the design was produced. Constrained to the two current sources.
  source TEXT NOT NULL CHECK (source IN ('template', 'upload')),

  -- The front artwork (always present) and optional back artwork. These mirror
  -- the shape of the profile pointers so "set active" is a straight copy.
  front_url TEXT NOT NULL,
  back_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The library is listed newest-first for the owner.
CREATE INDEX idx_postcard_designs_user_created
  ON postcard_designs(user_id, created_at DESC);

ALTER TABLE postcard_designs ENABLE ROW LEVEL SECURITY;

-- Owner can read their own library.
CREATE POLICY "Users can read own postcard designs"
  ON postcard_designs FOR SELECT
  USING (auth.uid() = user_id);

-- Owner can add their own designs. Writes may also come from the service-role
-- client (which bypasses RLS) — both paths are allowed.
CREATE POLICY "Users can insert own postcard designs"
  ON postcard_designs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Owner can remove designs from their own library. This never touches the
-- active-design profile pointers.
CREATE POLICY "Users can delete own postcard designs"
  ON postcard_designs FOR DELETE
  USING (auth.uid() = user_id);
