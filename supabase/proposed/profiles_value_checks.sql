-- Database-level limits on fields a user can write to their own profile.
--
-- PATCH /api/settings validates these (lib/validation/settings.ts), but the
-- columns are also granted to `authenticated` for direct PostgREST updates
-- (20260920000001), so the API is not the only way in.
--
-- NOT VALID: existing rows aren't checked (some older saved searches are
-- wider than 10 miles; Home caps them at 10 when it loads). Every new write
-- is. Run `ALTER TABLE profiles VALIDATE CONSTRAINT ...` later once old rows
-- are tidied, if wanted.

ALTER TABLE profiles
  ADD CONSTRAINT profiles_radius_1_to_10
    CHECK (search_radius_miles IS NULL OR search_radius_miles BETWEEN 1 AND 10) NOT VALID,
  ADD CONSTRAINT profiles_prices_sane
    CHECK (
      (min_price IS NULL OR min_price >= 0)
      AND (max_price IS NULL OR max_price >= 0)
      AND (min_price IS NULL OR max_price IS NULL OR min_price < max_price)
    ) NOT VALID,
  ADD CONSTRAINT profiles_property_types_known
    CHECK (property_types IS NULL OR property_types <@ ARRAY['D','S','T','F','O']::text[]) NOT VALID;

-- Design files must be this project's public postcard-designs URLs in the
-- user's own folder. The URL prefix is the project's, so set it here:
--   https://dgscubksafqxpccjsqis.supabase.co/storage/v1/object/public/postcard-designs/
ALTER TABLE profiles
  ADD CONSTRAINT profiles_design_urls_own_folder
    CHECK (
      (postcard_design_url IS NULL OR postcard_design_url LIKE
        'https://dgscubksafqxpccjsqis.supabase.co/storage/v1/object/public/postcard-designs/' || id::text || '/%')
      AND (postcard_design_back_url IS NULL OR postcard_design_back_url LIKE
        'https://dgscubksafqxpccjsqis.supabase.co/storage/v1/object/public/postcard-designs/' || id::text || '/%')
    ) NOT VALID;
