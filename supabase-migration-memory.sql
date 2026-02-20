-- Migration: Add agent_memory table and new chat turn types
-- Run this in Supabase SQL Editor on your EXISTING database

-- 1. Create agent_memory table
CREATE TABLE IF NOT EXISTS agent_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('decision', 'task', 'learning', 'preference')),
    content TEXT NOT NULL,
    context TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_memory_project ON agent_memory(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agent_name);

-- 2. Update chat_turns check constraint to allow new turn types
ALTER TABLE chat_turns DROP CONSTRAINT IF EXISTS chat_turns_turn_type_check;
ALTER TABLE chat_turns ADD CONSTRAINT chat_turns_turn_type_check
    CHECK (turn_type IN ('proposal', 'critique', 'resolution', 'discussion', 'consultation', 'routing', 'execution', 'boss_command', 'direct', 'direct_command'));

-- 3. Enable Realtime on agent_memory
ALTER PUBLICATION supabase_realtime ADD TABLE agent_memory;
