-- Atomic increment for the per-period postcard counter.
-- Replaces a read-modify-write in the dispatch route that could lose updates
-- when a user sent postcards from two requests at once (letting them exceed
-- their free allowance without overage billing).

CREATE OR REPLACE FUNCTION increment_postcards_used(p_user_id uuid, p_amount int)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE profiles
  SET postcards_used_this_period = COALESCE(postcards_used_this_period, 0) + p_amount
  WHERE id = p_user_id;
$$;
