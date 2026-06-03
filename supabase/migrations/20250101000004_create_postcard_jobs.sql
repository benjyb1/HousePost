-- Postcard dispatch records
CREATE TABLE postcard_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  lead_month TEXT NOT NULL,

  -- PostGrid
  postgrid_letter_id TEXT,
  postgrid_status TEXT,

  -- Recipient (denormalised)
  recipient_address_line TEXT NOT NULL,
  recipient_postcode TEXT NOT NULL,

  -- Billing
  stripe_payment_intent_id TEXT,
  was_included_in_subscription BOOLEAN NOT NULL DEFAULT TRUE,
  charge_amount_pence INTEGER NOT NULL DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','dispatched','failed','cancelled')),
  dispatched_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER postcard_jobs_updated_at
  BEFORE UPDATE ON postcard_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_pj_user_month ON postcard_jobs(user_id, lead_month);
CREATE INDEX idx_pj_postgrid_id ON postcard_jobs(postgrid_letter_id)
  WHERE postgrid_letter_id IS NOT NULL;

ALTER TABLE postcard_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own postcard jobs"
  ON postcard_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Add FK from leads to postcard_jobs (deferred reference)
ALTER TABLE leads
  ADD CONSTRAINT leads_postcard_job_fk
  FOREIGN KEY (postcard_job_id)
  REFERENCES postcard_jobs(id)
  ON DELETE SET NULL;
