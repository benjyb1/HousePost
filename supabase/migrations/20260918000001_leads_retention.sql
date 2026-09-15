-- Leads data retention (feature 8.9).
--
-- Policy the retention cron (app/api/cron/retention) enforces daily:
--   1. ARCHIVE:  an UNUSED lead (never sent — postcard_job_id IS NULL) that has
--                been in the account for 3 months is moved to Archived by setting
--                archived_at = now().
--   2. DELETE:   an archived lead is permanently deleted 3 months after it was
--                archived (archived_at < now() - 3 months). That gives an unused
--                lead a ~6-month maximum lifetime (3 months active + 3 archived),
--                whether it was archived automatically by the cron or manually by
--                the user.
--
-- Send history is NEVER touched by retention: it lives in `postcard_jobs`
-- (which carries its own denormalised recipient snapshot), and this migration
-- and the cron only ever act on `leads` rows whose postcard_job_id IS NULL.
-- Sent/targeted leads (postcard_job_id IS NOT NULL) are excluded from both the
-- archive and the delete step.
--
-- The columns this relies on already exist: `created_at` (from
-- 20250101000003_create_leads.sql) drives step 1, and `archived_at` (from
-- 20250101000011_add_leads_archived_at.sql) drives step 2. No new columns are
-- required; this migration only adds partial indexes so the two daily sweeps
-- stay cheap as the table grows. All statements are idempotent.

-- Step 1 support: quickly find unused, un-archived leads old enough to archive.
-- Partial so the index only covers the (small, churning) candidate set rather
-- than every historical row.
CREATE INDEX IF NOT EXISTS idx_leads_retention_archive
  ON leads (created_at)
  WHERE archived_at IS NULL AND postcard_job_id IS NULL;

-- Step 2 support: quickly find archived, unused leads old enough to delete.
CREATE INDEX IF NOT EXISTS idx_leads_retention_delete
  ON leads (archived_at)
  WHERE archived_at IS NOT NULL AND postcard_job_id IS NULL;
