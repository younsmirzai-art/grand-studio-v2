-- Remove Realtime from tables that now use polling instead.
-- Keep Realtime only on chat_turns and ue5_commands.
-- Run this in Supabase SQL Editor.

ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS god_eye_log;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS tasks;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS world_state;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS agent_memory;
