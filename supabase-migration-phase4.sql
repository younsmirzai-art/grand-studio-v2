-- Phase 4: Reference images (Image to 3D), chat attachment, Playtest reports
-- Run in Supabase SQL Editor

-- Boss message image attachment (for "recreate this in UE5")
ALTER TABLE chat_turns ADD COLUMN IF NOT EXISTS attachment_url text;

-- Reference images for Image to 3D
CREATE TABLE IF NOT EXISTS reference_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  analysis text,
  generated_code text,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE reference_images DISABLE ROW LEVEL SECURITY;

-- Playtest reports (Feature 3)
CREATE TABLE IF NOT EXISTS playtest_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  score integer,
  critical_count integer DEFAULT 0,
  warning_count integer DEFAULT 0,
  minor_count integer DEFAULT 0,
  report_json jsonb,
  screenshot_url text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE playtest_reports DISABLE ROW LEVEL SECURITY;

-- Storage bucket "reference-images" must be created in Supabase Dashboard:
-- Storage -> New bucket -> name: reference-images, Public: Yes, File size limit: 10MB
-- Then add policies (or run below if storage schema exists):
-- CREATE POLICY "Allow ref image uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reference-images');
-- CREATE POLICY "Allow ref image reads" ON storage.objects FOR SELECT USING (bucket_id = 'reference-images');
