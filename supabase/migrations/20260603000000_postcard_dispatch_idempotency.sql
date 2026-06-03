-- Idempotency guard for postcard dispatch / resend.
--
-- A double-clicked or retried "send" must not create a second billable job row
-- for the same logical send (overage is billed per job, so a duplicate row is a
-- duplicate charge). Each resend tags its job with a deterministic
-- dispatch_idempotency_key, and a UNIQUE partial index makes a concurrent
-- duplicate insert fail so the second attempt is treated as a no-op.
--
-- The column is NULL for every existing row and for internal "pending" rows, so
-- the partial index (WHERE NOT NULL) can never conflict with historical data —
-- this migration is safe to apply to a populated table.

ALTER TABLE postcard_jobs
  ADD COLUMN IF NOT EXISTS dispatch_idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pj_dispatch_idempotency_key
  ON postcard_jobs (dispatch_idempotency_key)
  WHERE dispatch_idempotency_key IS NOT NULL;
