-- Migration: Support custom leads (manually added addresses without Land Registry data)

-- Make Land-Registry-specific columns nullable so custom leads can omit them
ALTER TABLE leads ALTER COLUMN transaction_id DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN price DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN property_type DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN tenure DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN date_of_transfer DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN distance_miles DROP NOT NULL;

-- Default is_new_build to false (custom leads won't supply this)
ALTER TABLE leads ALTER COLUMN is_new_build SET DEFAULT false;

-- Add flag to distinguish custom leads from Land Registry leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT false;

-- Replace the old unique constraint with a partial unique index that only
-- applies when transaction_id is present (custom leads have no transaction_id)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_user_id_transaction_id_lead_month_key;
CREATE UNIQUE INDEX IF NOT EXISTS leads_user_transaction_month_unique
  ON leads (user_id, transaction_id, lead_month)
  WHERE transaction_id IS NOT NULL;

-- Allow authenticated users to insert their own custom leads
CREATE POLICY "Users can insert own custom leads"
  ON leads FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_custom = true);
