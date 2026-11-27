-- Only subscribers (active or trialing) may read their homes directly.
--
-- Home and GET /api/leads now send a non-subscriber only their five open
-- homes (lib/leads/preview.ts), reading the rest with the service-role
-- client. But the "Users can read own leads" policy still lets anyone signed
-- in list every one of their leads straight from PostgREST with their own
-- token. This closes that.
--
-- Before applying, know what changes for a NON-subscriber, whose requests use
-- their own token and so now see only homes they added by hand:
--   * POST /api/leads/archive and /api/leads/unarchive update with the user's
--     client, so they would stop working on the five open homes. Switch those
--     two routes to the admin client (keeping the user_id filter) first.
--   * latestBatchMonth() falls back to the calendar month for them, so a
--     hand-added home lands in the current month's group.
--   * Sending already requires a subscription, so nothing changes there.
-- Subscribers see no difference.

DROP POLICY IF EXISTS "Users can read own leads" ON leads;

CREATE POLICY "Users can read own leads"
  ON leads FOR SELECT
  USING (
    auth.uid() = user_id
    AND (
      is_custom
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.subscription_status IN ('active', 'trialing')
      )
    )
  );
