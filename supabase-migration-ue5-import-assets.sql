-- UE5 import result tracking: command_type + import_context on ue5_commands, and ue5_import_assets table

-- ue5_commands: support import command type and context (source_provider, source_url, file_type)
ALTER TABLE ue5_commands ADD COLUMN IF NOT EXISTS command_type text DEFAULT 'execute';
ALTER TABLE ue5_commands ADD COLUMN IF NOT EXISTS import_context jsonb;

-- Table: one row per import (Sketchfab, Meshy, Poly Haven, etc.) after relay parses IMPORT_RESULT
CREATE TABLE IF NOT EXISTS ue5_import_assets (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    ue5_command_id uuid REFERENCES ue5_commands(id) ON DELETE SET NULL,
    source_provider text NOT NULL,
    source_url text,
    file_type text,
    ue_asset_path text,
    material_count integer DEFAULT 0,
    texture_count integer DEFAULT 0,
    import_status text NOT NULL CHECK (import_status IN ('textured', 'materials_only', 'mesh_only', 'failed')),
    import_error text,
    preview_image_url text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ue5_import_assets_project ON ue5_import_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_ue5_import_assets_command ON ue5_import_assets(ue5_command_id);
CREATE INDEX IF NOT EXISTS idx_ue5_import_assets_created ON ue5_import_assets(created_at DESC);

ALTER TABLE ue5_import_assets DISABLE ROW LEVEL SECURITY;
