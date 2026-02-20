"use client";

import { useMemo } from "react";
import LiveViewport from "./LiveViewport";

export interface PixelStreamingViewerProps {
  projectId: string;
  /** Signaling server URL (e.g. ws://localhost:8888) */
  signalingUrl: string | null;
  /** Whether Pixel Streaming is connected (test passed) */
  isConnected: boolean;
  /** Refresh interval for screenshot fallback in seconds */
  refreshInterval?: number;
}

/**
 * When Pixel Streaming is connected, embeds the UE5 stream (iframe to player page).
 * When not connected, shows fallback message and LiveViewport (screenshot mode).
 */
export default function PixelStreamingViewer({
  projectId,
  signalingUrl,
  isConnected,
  refreshInterval = 5,
}: PixelStreamingViewerProps) {
  const streamPageUrl = useMemo(() => {
    if (!signalingUrl) return null;
    try {
      const u = signalingUrl.trim().replace(/^ws:/i, "http:");
      return u;
    } catch {
      return null;
    }
  }, [signalingUrl]);

  if (isConnected && streamPageUrl) {
    return (
      <div className="flex flex-col h-full w-full bg-black rounded-lg overflow-hidden border border-boss-border">
        <div className="px-2 py-1 bg-boss-elevated/80 border-b border-boss-border text-xs text-text-muted shrink-0">
          🖥️ Pixel Streaming (live interactive)
        </div>
        <iframe
          src={streamPageUrl}
          title="UE5 Pixel Stream"
          className="flex-1 w-full min-h-[240px] border-0"
          allow="autoplay; fullscreen; xr-spatial-tracking"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="px-2 py-1.5 rounded bg-boss-elevated/50 border border-boss-border text-xs text-text-muted shrink-0">
        Pixel Streaming not connected. Using screenshot mode instead.
      </div>
      <div className="flex-1 min-h-0">
        <LiveViewport projectId={projectId} refreshInterval={refreshInterval} />
      </div>
    </div>
  );
}
