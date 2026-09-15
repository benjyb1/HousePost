-- Consolidate postcard status onto a single `status` column.
--
-- Background. postcard_jobs has carried TWO status columns since the PostGrid
-- era:
--   * status          — a coarse lifecycle enum, CHECK-constrained to
--                        ('pending','dispatched','failed','cancelled').
--   * postgrid_status  — a legacy, free-text column that actually holds the
--                        fine-grained fulfilment state (received / processing /
--                        printed / …). The Tracking page reads
--                        `postgrid_status ?? status` and prefers it.
--
-- Goal. Move to a SINGLE `status` column that holds the fine-grained pipeline
-- state, without breaking anything before this migration is applied.
--
-- Transition strategy (why the app keeps reading `postgrid_status ?? status`):
--   * This migration RELAXES the status CHECK to accept the full pipeline
--     vocabulary and BACKFILLS status from postgrid_status.
--   * The status poller (app/api/cron/poll-postcard-status) writes the neutral
--     status to BOTH columns, so the on-screen value (postgrid_status ?? status)
--     stays correct whether or not this migration has run yet, and status is
--     kept in step as the eventual single source of truth.
--   * postgrid_status is deliberately LEFT IN PLACE. Dropping it is a later,
--     separate migration to run only once all readers prefer `status`. Keeping
--     it means old and new code both work during the rollout.
--
-- NOTE: no supplier is named anywhere; the pipeline vocabulary below is neutral.
-- NOT APPLIED to any database yet — review before running. See PR/report.

-- 1. Relax the status CHECK so the column can hold the full pipeline vocabulary.
--    The old constraint only allowed pending/dispatched/failed/cancelled, which
--    would reject the intermediate states (received/processing/production/
--    printed) that the poller now writes.
ALTER TABLE postcard_jobs
  DROP CONSTRAINT IF EXISTS postcard_jobs_status_check;

ALTER TABLE postcard_jobs
  ADD CONSTRAINT postcard_jobs_status_check
  CHECK (status IN (
    'pending',
    'received',
    'processing',
    'production',
    'printed',
    'dispatched',
    'delivered',
    'held',
    'dispatching',
    'provider_hold',
    'error',
    'failed',
    'cancelled'
  ));

-- 2. Backfill status from postgrid_status where the legacy column holds a finer
--    value. Guarded to only copy values that are already members of the new
--    enum, so any stray raw provider spelling from the past is left untouched
--    (the poller normalises those onto both columns on its next pass) and this
--    UPDATE can never itself violate the CHECK added above.
UPDATE postcard_jobs
  SET status = postgrid_status
  WHERE postgrid_status IS NOT NULL
    AND postgrid_status <> ''
    AND postgrid_status <> status
    AND postgrid_status IN (
      'pending',
      'received',
      'processing',
      'production',
      'printed',
      'dispatched',
      'delivered',
      'provider_hold',
      'error',
      'failed',
      'cancelled'
    );

-- 3. Help the poller find non-terminal jobs cheaply.
CREATE INDEX IF NOT EXISTS idx_pj_status ON postcard_jobs(status);
