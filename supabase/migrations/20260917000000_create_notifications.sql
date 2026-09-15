-- Per-user notifications feed.
--
-- Powers the dashboard "Recent activity" list and the /notifications page.
-- Rows are written by the service-role client (see lib/notifications/index.ts:
-- createNotification) from the lead-generation and postcard-send flows, and read
-- back by the owning user. Two event types exist today:
--   * leads_dropped   — a fresh batch of leads was generated for the user.
--   * leads_purchased  — the user purchased / sent a batch of postcards.
-- The `type` column is left as free TEXT (no CHECK) so new event kinds can be
-- added later without a schema migration; the app owns the vocabulary.
--
-- NOT APPLIED to any database yet — review before running. See PR/report.

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Event kind, e.g. 'leads_dropped' | 'leads_purchased'. Free text by design.
  type TEXT NOT NULL,

  -- Short headline and longer body shown in the feed.
  title TEXT NOT NULL,
  body TEXT,

  -- Optional in-app link the notification points at, e.g. '/leads'.
  href TEXT,

  read BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The feed and the /notifications page both read a user's rows newest-first.
CREATE INDEX idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- A user can read only their own notifications. Writes happen via the
-- service-role client (which bypasses RLS), so no INSERT policy is needed.
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- A user may mark their own notifications read (the only field they can change).
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
