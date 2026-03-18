-- Grand Studio: generated_music — AI Music Studio track metadata

CREATE TABLE IF NOT EXISTS generated_music (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    task_id text NOT NULL,
    prompt text,
    style text,
    duration text,
    status text NOT NULL DEFAULT 'pending',
    audio_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_generated_music_user ON generated_music(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_music_task ON generated_music(task_id);
CREATE INDEX IF NOT EXISTS idx_generated_music_created ON generated_music(created_at DESC);

ALTER TABLE generated_music DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE generated_music IS 'AI Music Studio generated tracks.';
