-- Usage tracking for subscription limits (daily and max_projects)
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.usage_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  action_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_date ON public.usage_logs(user_id, created_at);
ALTER TABLE public.usage_logs DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.usage_logs IS 'Daily usage counts per user for ai_message, polyhaven_import, sketchfab_import, screenshot.';
