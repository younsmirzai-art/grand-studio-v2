-- Migration: Add tables for sidebar tools (voice, lore, settings)
-- Run this in Supabase SQL Editor

-- Voice lines (dialogue for characters)
CREATE TABLE IF NOT EXISTS voice_lines (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    character_name text NOT NULL,
    dialogue text NOT NULL,
    voice_type text DEFAULT 'male',
    scene text,
    created_by text DEFAULT 'boss',
    created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voice_lines_project ON voice_lines(project_id);
ALTER TABLE voice_lines DISABLE ROW LEVEL SECURITY;

-- Lore entries (wiki-style game lore)
CREATE TABLE IF NOT EXISTS lore_entries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    category text NOT NULL DEFAULT 'general',
    title text NOT NULL,
    content text NOT NULL,
    tags text[] DEFAULT '{}',
    created_by text DEFAULT 'boss',
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lore_entries_project ON lore_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_lore_entries_category ON lore_entries(category);
ALTER TABLE lore_entries DISABLE ROW LEVEL SECURITY;

-- Project settings
CREATE TABLE IF NOT EXISTS project_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
    genre text DEFAULT 'action',
    platform text DEFAULT 'pc',
    language text DEFAULT 'en',
    response_length text DEFAULT 'medium',
    active_agents text[] DEFAULT ARRAY['nima','alex','thomas','elena','morgan'],
    ue5_host text DEFAULT 'localhost:30010',
    updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_settings_project ON project_settings(project_id);
ALTER TABLE project_settings DISABLE ROW LEVEL SECURITY;
