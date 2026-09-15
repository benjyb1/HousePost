-- Suppression list for the public opt-out feature.
--
-- When a member of the public asks us not to post marketing to their address,
-- we record a normalised comparison key here. Lead generation loads these keys
-- in bulk and excludes any matching property (see lib/leads/generator.ts and
-- lib/address/normalise.ts). The raw submitted fields are kept for audit /
-- manual review; only `address_key` is used for matching.

CREATE TABLE suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stable comparison key produced by lib/address/normalise.ts:addressKey().
  -- Matching is done entirely on this column.
  address_key TEXT NOT NULL,

  -- Raw submitted values, retained for audit and any manual reconciliation.
  raw_address TEXT NOT NULL,          -- address exactly as the person entered it
  postcode TEXT NOT NULL,             -- normalised postcode (uppercase, single space)

  -- Where the suppression came from: 'opt_out_form' for public submissions,
  -- leaving room for 'manual' / 'import' etc. later.
  source TEXT NOT NULL DEFAULT 'opt_out_form',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The matching path is a bulk read of all keys, plus point lookups; index the key.
CREATE INDEX idx_suppression_address_key ON suppression_list(address_key);

-- Lock the table down. The opt-out endpoint writes via the service-role client
-- (which bypasses RLS), and lead generation reads via the service-role client
-- too. No anon / authenticated access at all: a blanket USING (false) policy
-- denies every row to ordinary roles while service_role continues to bypass RLS.
ALTER TABLE suppression_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to suppression_list"
  ON suppression_list FOR ALL
  USING (false)
  WITH CHECK (false);
