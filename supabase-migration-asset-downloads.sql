-- Track downloaded assets to avoid re-downloading
CREATE TABLE IF NOT EXISTS downloaded_assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL,           -- 'polyhaven' or 'sketchfab'
  source_id text NOT NULL,        -- asset ID from the platform
  name text NOT NULL,
  storage_url text NOT NULL,
  format text DEFAULT 'gltf',
  file_size_bytes integer DEFAULT 0,
  license text DEFAULT 'CC0',
  downloaded_at timestamptz DEFAULT now(),
  UNIQUE(source, source_id)
);

ALTER TABLE downloaded_assets DISABLE ROW LEVEL SECURITY;
