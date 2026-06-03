-- Create public storage bucket for postcard designs
INSERT INTO storage.buckets (id, name, public)
  VALUES ('postcard-designs', 'postcard-designs', true)
  ON CONFLICT (id) DO NOTHING;

-- Users can upload their own design file
CREATE POLICY "Users upload own design"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'postcard-designs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can overwrite their own design file
CREATE POLICY "Users update own design"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'postcard-designs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own design file
CREATE POLICY "Users delete own design"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'postcard-designs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Anyone can read designs (PostGrid needs public access to fetch the image)
CREATE POLICY "Public read designs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'postcard-designs');
