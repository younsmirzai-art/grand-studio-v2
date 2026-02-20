-- UE5 Live Vision — Supabase Migration
-- Run this in Supabase SQL Editor

-- Add screenshot_url to ue5_commands
ALTER TABLE ue5_commands ADD COLUMN IF NOT EXISTS screenshot_url text;

-- Add screenshot_url to chat_turns (for execution result turns)
ALTER TABLE chat_turns ADD COLUMN IF NOT EXISTS screenshot_url text;

-- Allow status 'success_with_screenshot' for ue5_commands (optional, relay uses 'success')
-- The status check constraint may need updating - check your schema
-- If you have: CHECK (status IN ('pending', 'executing', 'success', 'error'))
-- You can add: ALTER TABLE ue5_commands DROP CONSTRAINT IF EXISTS ue5_commands_status_check;
-- Then: ALTER TABLE ue5_commands ADD CONSTRAINT ue5_commands_status_check CHECK (status IN ('pending', 'executing', 'success', 'error', 'success_with_screenshot'));

-- Storage bucket "ue5-captures" must be created manually in Supabase Dashboard:
-- Storage → New Bucket → Name: ue5-captures, Public: Yes, File size limit: 10MB
