-- Custom postcard design requests (feature 10.5).
--
-- A row is created when a customer submits the "Request custom design (£75)"
-- brief AFTER their card is charged. The brief text and references to the
-- uploaded assets live here; the asset files themselves are stored in the
-- existing `postcard-designs` storage bucket under
--   {user_id}/design-requests/{request_id}/{filename}
-- (that bucket's per-user-folder RLS already scopes them to the owner).
--
-- Rows are written by the service-role client (see
-- app/api/postcards/design-request/route.ts) and read back by the owning user.
--
-- NOT APPLIED to any database yet — review before running. See PR/report.

CREATE TABLE design_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The requesting user. SET NULL on account deletion so the paid-request record
  -- (a financial event) is preserved for reconciliation, matching how postcard
  -- history is detached rather than destroyed when a user is deleted.
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Fulfilment status. Free text by design so the team's workflow can grow
  -- (e.g. 'received' -> 'in_progress' -> 'delivered') without a migration.
  status TEXT NOT NULL DEFAULT 'received',

  -- The brief.
  business_name TEXT NOT NULL,
  colour_scheme TEXT,
  brief_text TEXT,           -- copy to appear on the card
  notes TEXT,                -- design pointers / anything else

  -- References to the uploaded assets in storage:
  -- [{ "path": "...", "name": "...", "type": "...", "size": 123 }, ...]
  assets JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Billing: the one-off fee taken up front and the PaymentIntent it settled on.
  amount_pence INTEGER NOT NULL DEFAULT 7500,
  stripe_payment_intent_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The owner (and the team, via admin tooling) list requests newest-first.
CREATE INDEX idx_design_requests_user_created
  ON design_requests(user_id, created_at DESC);

ALTER TABLE design_requests ENABLE ROW LEVEL SECURITY;

-- A user can read only their own requests. Writes happen via the service-role
-- client (which bypasses RLS), so no INSERT/UPDATE policy is granted to users —
-- this keeps status, billing fields and asset references team-controlled.
CREATE POLICY "Users can read own design requests"
  ON design_requests FOR SELECT
  USING (auth.uid() = user_id);
