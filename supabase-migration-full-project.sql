-- Full Project Mode: persistent run state and control
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS full_project_run (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  boss_prompt text NOT NULL,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'executing', 'paused', 'stopped', 'completed', 'failed')),
  current_task_index integer DEFAULT 0,
  plan_json jsonb DEFAULT '[]',
  summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_full_project_run_project ON full_project_run(project_id);
ALTER TABLE full_project_run DISABLE ROW LEVEL SECURITY;
