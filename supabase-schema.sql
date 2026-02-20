-- Grand Studio v2 — Supabase Database Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    initial_prompt TEXT NOT NULL,
    summary TEXT DEFAULT '',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (Boss assigns these)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    assigned_to TEXT NOT NULL,
    depends_on UUID[] DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'blocked')),
    result TEXT DEFAULT '',
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);

-- Chat turns (team conversation)
CREATE TABLE chat_turns (
    id BIGSERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    agent_title TEXT NOT NULL,
    content TEXT NOT NULL,
    turn_type TEXT DEFAULT 'discussion' CHECK (turn_type IN ('proposal', 'critique', 'resolution', 'discussion', 'consultation', 'routing', 'execution', 'boss_command', 'direct', 'direct_command')),
    task_id UUID REFERENCES tasks(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chat_turns_project ON chat_turns(project_id);

-- Decisions
CREATE TABLE decisions (
    id BIGSERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    decision TEXT NOT NULL,
    rationale TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game Lore (GDD)
CREATE TABLE game_lore (
    id BIGSERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, category, key)
);

-- World State (entities in the game world)
CREATE TABLE world_state (
    id BIGSERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    attributes JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, entity_type, entity_id)
);

-- God-Eye execution log
CREATE TABLE god_eye_log (
    id BIGSERIAL PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    agent_name TEXT DEFAULT '',
    detail TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_god_eye_project ON god_eye_log(project_id);

-- UE5 execution queue (cloud → local bridge)
CREATE TABLE ue5_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'success', 'error')),
    result TEXT DEFAULT '',
    error_log TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

-- Voiceover metadata
CREATE TABLE voiceover_metadata (
    id BIGSERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    dialogue_text TEXT,
    voice_id TEXT,
    audio_url TEXT,
    character_id TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Memory (stores decisions, learnings, preferences per agent per project)
CREATE TABLE agent_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('decision', 'task', 'learning', 'preference')),
    content TEXT NOT NULL,
    context TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_agent_memory_project ON agent_memory(project_id);
CREATE INDEX idx_agent_memory_agent ON agent_memory(agent_name);

-- Enable Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE chat_turns;
ALTER PUBLICATION supabase_realtime ADD TABLE god_eye_log;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE ue5_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE world_state;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_memory;
