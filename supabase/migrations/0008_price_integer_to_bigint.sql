-- Fix integer overflow for high-value properties (prices stored in pence).
-- Properties above ~£21.4M overflow the integer max of 2,147,483,647.
ALTER TABLE property_transactions ALTER COLUMN price TYPE BIGINT;
ALTER TABLE leads ALTER COLUMN price TYPE BIGINT;
ALTER TABLE profiles ALTER COLUMN min_price TYPE BIGINT;
ALTER TABLE profiles ALTER COLUMN max_price TYPE BIGINT;
