-- Relay heartbeat: so the website can show "Relay Connected" when the local relay is running
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS relay_heartbeat (
    id text PRIMARY KEY DEFAULT 'local-relay',
    last_ping timestamptz DEFAULT now(),
    ue5_connected boolean DEFAULT false,
    relay_version text DEFAULT '1.0.0'
);

ALTER TABLE relay_heartbeat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for relay_heartbeat"
ON relay_heartbeat FOR ALL
USING (true) WITH CHECK (true);
