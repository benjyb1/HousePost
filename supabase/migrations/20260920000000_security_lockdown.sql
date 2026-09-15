-- Security lock-down (post-review fix).
--
-- The per-period postcard counter is now a money gate: the first
-- INCLUDED_POSTCARDS_PER_MONTH cards skip the Stripe charge, and MONTHLY_POSTCARD_CAP
-- limits paid sends. So a client must NOT be able to reset it (or the subscription
-- fields) directly through the REST API, and the usage RPCs must not be callable
-- with an anon/authenticated key.

-- 1. Remove client UPDATE on billing/usage columns of profiles.
--    RLS still lets a user update their own profile row; PostgreSQL column
--    privileges compose with RLS, so this strips just these columns from
--    anon/authenticated and leaves the rest (office_postcode, preferences,
--    email_notifications, name, etc.) editable as before. service_role is
--    untouched, so the Stripe webhooks / admin client still write them.
REVOKE UPDATE (
  postcards_used_this_period,
  subscription_status,
  stripe_customer_id,
  stripe_subscription_id,
  subscription_period_end,
  current_period_start
) ON profiles FROM anon, authenticated;

-- 2. The usage RPCs are SECURITY INVOKER and were executable by PUBLIC.
--    Only the server (service_role, via the admin client) may call them.
REVOKE EXECUTE ON FUNCTION
  increment_postcards_used(uuid, int),
  increment_postcards_used_capped(uuid, int, int),
  decrement_postcards_used(uuid, int)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  increment_postcards_used(uuid, int),
  increment_postcards_used_capped(uuid, int, int),
  decrement_postcards_used(uuid, int)
TO service_role;

-- 3. Notifications: a user may flip `read`, not rewrite title/body/type/href.
REVOKE UPDATE ON notifications FROM anon, authenticated;
GRANT UPDATE (read) ON notifications TO authenticated;
