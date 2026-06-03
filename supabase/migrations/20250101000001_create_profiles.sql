-- Trigger function to keep updated_at current
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Profiles: one row per Supabase auth user
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',

  -- Location
  office_postcode TEXT NOT NULL DEFAULT '',
  office_lat DOUBLE PRECISION,
  office_lng DOUBLE PRECISION,

  -- Search preferences
  search_radius_miles INTEGER NOT NULL DEFAULT 10
    CHECK (search_radius_miles BETWEEN 1 AND 50),
  min_price INTEGER,      -- in pence; null = no minimum
  max_price INTEGER,      -- in pence; null = no maximum
  property_types TEXT[] NOT NULL DEFAULT ARRAY['D','S','T','F','O'],

  -- Postcard design
  postcard_design_url TEXT,

  -- Stripe
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  subscription_status TEXT NOT NULL DEFAULT 'incomplete'
    CHECK (subscription_status IN (
      'incomplete','incomplete_expired','trialing','active',
      'past_due','canceled','unpaid','paused'
    )),
  subscription_period_end TIMESTAMPTZ,
  postcards_used_this_period INTEGER NOT NULL DEFAULT 0,
  current_period_start TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
