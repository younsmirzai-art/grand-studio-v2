-- Grand Studio: generated_3d_assets — unified 3D generation job tracking (Meshy, Grand Forge, etc.)
-- Import results still flow into ue5_import_assets via the shared UE5 import pipeline.

CREATE TABLE IF NOT EXISTS generated_3d_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id) ON DELETE SET NULL,  -- set when user imports to a project
    user_id text NOT NULL,
    prompt text NOT NULL,
    provider text NOT NULL CHECK (provider IN ('meshy', 'masterpiece')),
    provider_job_id text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    preview_url text,
    source_asset_url text,
    source_file_type text,
    ue5_command_id uuid REFERENCES ue5_commands(id) ON DELETE SET NULL,
    ue_asset_path text,
    import_status text CHECK (import_status IS NULL OR import_status IN ('textured', 'materials_only', 'mesh_only', 'failed')),
    material_count integer,
    texture_count integer,
    import_error text,
    raw_provider_response jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_3d_assets_project ON generated_3d_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_3d_assets_user ON generated_3d_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_3d_assets_provider_job ON generated_3d_assets(provider, provider_job_id);
CREATE INDEX IF NOT EXISTS idx_generated_3d_assets_created ON generated_3d_assets(created_at DESC);

ALTER TABLE generated_3d_assets DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE generated_3d_assets IS '3D generation jobs from Meshy, Grand Forge, etc. Import to UE5 uses same pipeline and fills ue5_import_assets.';
