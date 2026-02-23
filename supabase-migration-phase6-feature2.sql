-- Phase 6 Feature 2: Multiplayer / collaboration columns
-- Run once in Supabase SQL Editor after phase6 tables exist.

-- Chat: who sent the message (for "Youns: @thomas build a castle")
ALTER TABLE chat_turns ADD COLUMN IF NOT EXISTS user_email text;
ALTER TABLE chat_turns ADD COLUMN IF NOT EXISTS user_name text DEFAULT 'Boss';

-- God-Eye: who triggered the action (for "👤 Youns sent code to UE5")
ALTER TABLE god_eye_log ADD COLUMN IF NOT EXISTS user_email text;
ALTER TABLE god_eye_log ADD COLUMN IF NOT EXISTS user_name text DEFAULT '';

-- UE5 command queue: who submitted (for "⏳ Ali's command is executing")
ALTER TABLE ue5_commands ADD COLUMN IF NOT EXISTS submitted_by_email text;
ALTER TABLE ue5_commands ADD COLUMN IF NOT EXISTS submitted_by_name text;

-- Team members: pending invite until accepted
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS invited_by text;
