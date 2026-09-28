-- Fix list (Sept 2026), items 4.4 and 6.1. Additive only: two nullable
-- columns, safe to apply before the code that uses them ships.

-- 4.4 Unarchive. When the user last moved a lead out of Archived. Shown as
-- "Unarchived 27 Sep" next to the address, and the retention cron counts the
-- three-month auto-archive window from here rather than created_at, so an
-- unarchived lead isn't archived again the next morning.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS unarchived_at TIMESTAMPTZ;

-- 6.1 When the user last clicked through the dashboard's "postcards could not
-- be sent" message. The message only counts cards that failed after this, so
-- it stays gone on refresh and on other devices until something new fails.
-- Written by the server (service role) only, so no client UPDATE grant.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_notice_dismissed_at TIMESTAMPTZ;
