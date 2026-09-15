-- Corrective lock-down.
--
-- The column-level REVOKE in 20260920000000 was a no-op: Supabase grants a
-- TABLE-level UPDATE on profiles to `authenticated`, and a table-level grant
-- overrides column REVOKEs (has_column_privilege still returns true). To make
-- the usage/billing columns truly un-writable by clients we must remove the
-- table-level UPDATE and re-grant only the columns a user may legitimately edit
-- via the settings API and signup.
--
-- Server-side writers (Stripe webhooks, billing, the capped RPCs) all use the
-- service_role client, which is untouched by these REVOKEs, so they keep working.

REVOKE UPDATE ON profiles FROM anon, authenticated;

GRANT UPDATE (
  full_name,
  company_name,
  email,
  office_postcode,
  office_lat,
  office_lng,
  search_radius_miles,
  min_price,
  max_price,
  property_types,
  postcard_design_url,
  postcard_design_back_url,
  email_notifications
) ON profiles TO authenticated;
