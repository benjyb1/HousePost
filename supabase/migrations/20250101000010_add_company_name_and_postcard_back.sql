-- Add company_name field for signup
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name text;

-- Add postcard back side design URL
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS postcard_design_back_url text;
