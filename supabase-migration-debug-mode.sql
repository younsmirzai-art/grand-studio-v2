-- Add Debug Mode (Morgan auto-fix) to project_settings
ALTER TABLE project_settings
ADD COLUMN IF NOT EXISTS debug_mode_auto boolean DEFAULT true;

COMMENT ON COLUMN project_settings.debug_mode_auto IS 'When ON, Morgan auto-debugs UE5 execution errors; when OFF, only show errors in chat.';
