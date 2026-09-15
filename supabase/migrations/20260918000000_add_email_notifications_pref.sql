-- Per-user preference: email me when a new in-app notification is created.
--
-- Governs the notification -> email link in lib/notifications/index.ts
-- (createNotification). When TRUE (the default), a successful notification
-- insert also triggers a matching email via sendNotificationEmail; when FALSE,
-- the in-app notification is still created but no email is sent.
--
-- This covers non-essential notification emails only. Transactional emails
-- (e.g. the monthly "your leads are ready" summary, receipts) are unaffected.
--
-- Defaults to TRUE so existing users keep receiving emails; each user can opt
-- out from Settings (UK/EU e-privacy: a per-user opt-out is the right posture
-- for non-essential notification emails).
--
-- NOT APPLIED to any database yet — review before running. See PR/report.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT TRUE;
