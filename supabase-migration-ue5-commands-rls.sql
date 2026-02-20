-- Ensure ue5_commands allows inserts from app (relay uses service role; app uses API which uses service role).
-- Disable RLS so that any valid Supabase client can insert/read if needed (e.g. for consistency with other tool tables).
ALTER TABLE ue5_commands DISABLE ROW LEVEL SECURITY;
