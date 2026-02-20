-- Pixel Streaming settings per project
ALTER TABLE project_settings
ADD COLUMN IF NOT EXISTS pixel_streaming_url text DEFAULT 'ws://localhost:8888';

ALTER TABLE project_settings
ADD COLUMN IF NOT EXISTS pixel_streaming_connected boolean DEFAULT false;

COMMENT ON COLUMN project_settings.pixel_streaming_url IS 'Signaling server URL for UE5 Pixel Streaming (e.g. ws://localhost:8888)';
COMMENT ON COLUMN project_settings.pixel_streaming_connected IS 'Whether Pixel Streaming connection was last tested successfully';
