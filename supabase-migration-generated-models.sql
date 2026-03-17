-- Grand Studio: generated_models table for webhook / AI 3D Generator tracking
-- Run this in Supabase SQL Editor or via Supabase migrations.
--
-- Also create Storage buckets named:
--   - "meshy-uploads" (Public) for image/model uploads (Image to 3D, AI Texturing)
--   - "generated-models" (Public) for mirrored GLB/thumbnail assets from Meshy

CREATE TABLE IF NOT EXISTS generated_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  task_id text NOT NULL,
  prompt text,
  status text NOT NULL,
  model_url text,
  thumbnail_url text,
  art_style text,
  mode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_generated_models_user_id ON generated_models(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_models_task_id ON generated_models(task_id);
CREATE INDEX IF NOT EXISTS idx_generated_models_created_at ON generated_models(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_models_task_id_unique ON generated_models(task_id);

-- Optional: Enable RLS and allow service role / authenticated access as needed for your app.

COMMENT ON TABLE generated_models IS 'Stores completed AI 3D model generations from webhook (text-to-3d, image-to-3d, texture).';
