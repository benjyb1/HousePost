-- Account deletion support.
--
-- Goal: let a user delete their account and login WITHOUT destroying postcard
-- send history, which the business needs to retain.
--
-- Two problems this migration solves:
--   1. profiles.id references auth.users(id) ON DELETE CASCADE, so deleting the
--      auth user removes the profile row.
--   2. postcard_jobs.user_id references profiles(id) ON DELETE CASCADE, so that
--      profile removal would in turn CASCADE-DELETE all of the user's send
--      history. That is exactly what we must not do.
--
-- Fix: detach send history instead of cascading it away — make
-- postcard_jobs.user_id nullable and switch its FK to ON DELETE SET NULL. The
-- deletion endpoint nulls user_id explicitly before removing the auth user, and
-- this FK change is the backstop that keeps the rows even under cascade.
--
-- Also add profiles.deleted_at so a profile can be anonymised/soft-marked as
-- deleted before it is removed.
--
-- NOT APPLIED to any database yet — review before running. See PR/report.

-- 1. Soft-delete marker on profiles.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Detach send history instead of cascade-deleting it.
ALTER TABLE postcard_jobs
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE postcard_jobs
  DROP CONSTRAINT IF EXISTS postcard_jobs_user_id_fkey;

ALTER TABLE postcard_jobs
  ADD CONSTRAINT postcard_jobs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL;
