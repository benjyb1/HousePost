-- Add archived_at column so leads can be archived instead of deleted
ALTER TABLE leads ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX idx_leads_archived ON leads(user_id, archived_at);
