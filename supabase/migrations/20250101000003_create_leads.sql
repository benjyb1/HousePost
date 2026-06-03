-- Generated leads per client per month
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES property_transactions(id) ON DELETE CASCADE,

  -- Denormalised snapshot for fast display
  address_line TEXT NOT NULL,
  postcode TEXT NOT NULL,
  price INTEGER NOT NULL,              -- in pence
  property_type CHAR(1) NOT NULL,
  is_new_build BOOLEAN NOT NULL DEFAULT FALSE,
  tenure CHAR(1) NOT NULL,
  date_of_transfer DATE NOT NULL,

  -- Distance from user's office
  distance_miles DOUBLE PRECISION NOT NULL,

  -- Client selection
  selected_for_dispatch BOOLEAN NOT NULL DEFAULT FALSE,

  lead_month TEXT NOT NULL,            -- YYYY-MM

  -- Postcard link (set after dispatch)
  postcard_job_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, transaction_id, lead_month)
);

CREATE INDEX idx_leads_user_month ON leads(user_id, lead_month);
CREATE INDEX idx_leads_distance ON leads(user_id, lead_month, distance_miles);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own leads"
  ON leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own lead selection"
  ON leads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
