-- Add user_id to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Users can see their own projects
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create projects
CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update own projects
CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete own projects
CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Service role automatically bypasses RLS, no policy needed.
