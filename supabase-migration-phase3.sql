-- Phase 3: Music tracks table for Sana
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS music_tracks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  mood text DEFAULT 'ambient',
  tempo integer DEFAULT 120,
  tone_code text NOT NULL,
  duration_seconds integer DEFAULT 30,
  created_by text DEFAULT 'sana',
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_music_tracks_project ON music_tracks(project_id);
ALTER TABLE music_tracks DISABLE ROW LEVEL SECURITY;
