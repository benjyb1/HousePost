-- Postcard failure handling: keep the reason, retry supplier-side problems.
--
-- Background. When the release cron could not print a card it set status =
-- 'failed' and logged the reason to the console. Nothing stored it, so the
-- customer saw "Failed" and nobody could say why without Vercel access (which
-- only keeps an hour of logs on the current plan). The first live sends on
-- 17 Sep 2026 all failed with "Insufficient funds" on the print account and it
-- took a database token to find that out.
--
-- This migration adds:
--   * failure_reason / failure_category / failed_at — the customer-facing
--     reason and a coarse category, written when a card is finally failed.
--   * last_error / last_error_at / retry_count — the raw supplier error and
--     the retry counter for cards that are DELAYED (still 'held', release_at
--     pushed back) because the problem is on our side and will clear.
--   * ops_state — a tiny key/value table the app uses to rate-limit admin
--     alerts (one "balance low" email a day, not one every five minutes).
--
-- Additive only. Safe to apply before or after the matching code deploys.

ALTER TABLE postcard_jobs
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS failure_category TEXT,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

-- The ops page lists delayed cards (held with at least one retry) and recent
-- failures; both queries are cheap with these partial indexes.
CREATE INDEX IF NOT EXISTS idx_pj_delayed
  ON postcard_jobs (release_at)
  WHERE status = 'held' AND retry_count > 0;

CREATE INDEX IF NOT EXISTS idx_pj_failed_at
  ON postcard_jobs (failed_at)
  WHERE status = 'failed';

-- Backfill the five cards that failed on 17 Sep 2026 so the ops page and the
-- customer's Tracking table explain them. Only rows with no reason yet.
UPDATE postcard_jobs
   SET failure_category = 'print_credit',
       failure_reason = 'There was a temporary problem on our side with printing, so this postcard was not sent. Nothing was charged for it and the lead was returned to your list.',
       last_error = 'Stannp API error 400: Insufficient funds: 0.0000',
       failed_at = COALESCE(dispatching_at, updated_at)
 WHERE status = 'failed'
   AND failure_reason IS NULL
   AND dispatching_at >= '2026-09-17'
   AND postgrid_letter_id IS NULL;

-- Operator state for alert rate-limiting. Service-role only: RLS on, no
-- policies, so neither anon nor authenticated can read or write it.
CREATE TABLE IF NOT EXISTS ops_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ops_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ops_state FROM anon, authenticated;
