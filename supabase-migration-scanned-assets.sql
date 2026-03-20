CREATE TABLE IF NOT EXISTS public.scanned_assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  project_id text,
  assets jsonb DEFAULT '[]',
  scanned_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scanned_assets_user ON public.scanned_assets(user_id);

ALTER TABLE public.scanned_assets DISABLE ROW LEVEL SECURITY;

