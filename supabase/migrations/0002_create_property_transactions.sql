-- Property transactions from HM Land Registry
CREATE TABLE property_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  transaction_id TEXT NOT NULL,
  price INTEGER NOT NULL,              -- in pence (price_pounds * 100)
  date_of_transfer DATE NOT NULL,
  postcode TEXT NOT NULL,
  property_type CHAR(1) NOT NULL
    CHECK (property_type IN ('D','S','T','F','O')),
  is_new_build BOOLEAN NOT NULL DEFAULT FALSE,
  tenure CHAR(1) NOT NULL
    CHECK (tenure IN ('F','L')),

  -- Address components
  paon TEXT,
  saon TEXT,
  street TEXT,
  locality TEXT,
  town TEXT,
  district TEXT,
  county TEXT,
  address_line TEXT NOT NULL DEFAULT '', -- pre-built display address

  -- Geocoding (populated lazily)
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  geocoded_at TIMESTAMPTZ,

  -- Import tracking
  import_month TEXT NOT NULL,          -- YYYY-MM

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(transaction_id, import_month)
);

CREATE INDEX idx_pt_import_month ON property_transactions(import_month);
CREATE INDEX idx_pt_postcode ON property_transactions(postcode);
CREATE INDEX idx_pt_lat_lng ON property_transactions(lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX idx_pt_property_type ON property_transactions(property_type);
CREATE INDEX idx_pt_price ON property_transactions(price);

-- Service role only — no public access
ALTER TABLE property_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to transactions"
  ON property_transactions FOR ALL
  USING (false);
