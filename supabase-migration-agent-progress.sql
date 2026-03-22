-- Chunked agent execution: resume across multiple Vercel requests
-- Run in Supabase SQL editor or via migration pipeline

CREATE TABLE IF NOT EXISTS agent_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  session_id UUID NOT NULL,
  scene_request JSONB NOT NULL,
  asset_source TEXT NOT NULL DEFAULT 'library',
  phase TEXT NOT NULL DEFAULT 'search',
  search_results JSONB DEFAULT '[]'::jsonb,
  import_queue JSONB DEFAULT '[]'::jsonb,
  imported_assets JSONB DEFAULT '[]'::jsonb,
  imported_count INTEGER DEFAULT 0,
  total_imports INTEGER DEFAULT 0,
  placement_done BOOLEAN DEFAULT false,
  screenshot_done BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'in_progress',
  error_message TEXT,
  cumulative_elapsed_ms BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_progress_session ON agent_progress(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_progress_user_project ON agent_progress(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_agent_progress_status_updated ON agent_progress(status, updated_at);

COMMENT ON TABLE agent_progress IS 'Multi-chunk scene build: search/import/place state for resume after Vercel timeout';
