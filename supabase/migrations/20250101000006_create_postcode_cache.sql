-- Cache for postcodes.io geocoding results
CREATE TABLE postcode_cache (
  postcode TEXT PRIMARY KEY,           -- Normalised: uppercase, no extra spaces
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE postcode_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to postcode_cache"
  ON postcode_cache FOR ALL
  USING (false);
