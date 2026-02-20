"use client";

import { useEffect, useState, useCallback } from "react";
import { Camera, Maximize2, Minimize2, ZoomIn, ZoomOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/lib/stores/projectStore";

export interface LiveViewportProps {
  projectId: string;
  /** Refresh interval in seconds. Default 5. */
  refreshInterval?: number;
  fullscreen?: boolean;
  /** When true, render as compact PiP floating window */
  pipMode?: boolean;
  onExpandFromPiP?: () => void;
  onClosePiP?: () => void;
}

const INTERVAL_OPTIONS = [3, 5, 10, 30] as const;

export default function LiveViewport({
  projectId,
  refreshInterval = 5,
  fullscreen: fullscreenInitial = false,
  pipMode = false,
  onExpandFromPiP,
  onClosePiP,
}: LiveViewportProps) {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [intervalSec, setIntervalSec] = useState(refreshInterval);
  const [isFullscreen, setIsFullscreen] = useState(fullscreenInitial);
  const [zoom, setZoom] = useState(1);
  const [capturing, setCapturing] = useState(false);

  const isRelayConnected = useProjectStore((s) => s.isRelayConnected);

  const fetchLatestScreenshot = useCallback(async () => {
    const supabase = getClient();
    const { data } = await supabase
      .from("ue5_commands")
      .select("screenshot_url, executed_at")
      .eq("project_id", projectId)
      .not("screenshot_url", "is", null)
      .order("executed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.screenshot_url) {
      setScreenshotUrl(data.screenshot_url);
      setLastUpdated(data.executed_at ? new Date(data.executed_at) : null);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    fetchLatestScreenshot();
  }, [projectId, fetchLatestScreenshot]);

  useEffect(() => {
    if (!isRefreshing || !projectId) return;
    const timer = setInterval(fetchLatestScreenshot, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [projectId, intervalSec, isRefreshing, fetchLatestScreenshot]);

  async function captureNow() {
    setCapturing(true);
    try {
      await fetch("/api/ue5/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      setTimeout(() => {
        fetchLatestScreenshot();
      }, 3000);
    } finally {
      setCapturing(false);
    }
  }

  const timeAgo = lastUpdated
    ? lastUpdated.getTime() < Date.now() - 60000
      ? `${Math.floor((Date.now() - lastUpdated.getTime()) / 60000)}m ago`
      : `${Math.max(1, Math.floor((Date.now() - lastUpdated.getTime()) / 1000))}s ago`
    : "—";

  if (pipMode) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 w-[300px] rounded-lg border-2 border-boss-border bg-boss-surface shadow-xl flex flex-col overflow-hidden"
        style={{ height: "200px" }}
      >
        <div className="flex items-center justify-between px-2 py-1 border-b border-boss-border bg-boss-elevated shrink-0">
          <span className="text-xs font-medium text-text-primary truncate">🖥️ Live Viewport</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onExpandFromPiP}
              className="p-1 rounded hover:bg-boss-border text-text-muted hover:text-text-primary"
              title="Expand"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onClosePiP}
              className="p-1 rounded hover:bg-boss-border text-text-muted hover:text-text-primary"
              title="Close"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center bg-boss-elevated p-1">
          {screenshotUrl ? (
            <img
              src={screenshotUrl}
              alt="UE5 viewport"
              className="max-w-full max-h-full object-contain rounded"
            />
          ) : (
            <span className="text-[10px] text-text-muted">No screenshot</span>
          )}
        </div>
        <div className="px-2 py-0.5 text-[10px] text-text-muted flex justify-between">
          <span>Updated {timeAgo}</span>
          <span className={isRelayConnected ? "text-agent-green" : "text-text-muted"}>
            {isRelayConnected ? "🟢 Live" : "⚫ Offline"}
          </span>
        </div>
      </div>
    );
  }

  const panel = (
    <div
      className={`flex flex-col overflow-hidden bg-boss-surface border border-boss-border rounded-lg ${
        isFullscreen ? "fixed inset-4 z-50 rounded-xl" : "w-full"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-boss-border shrink-0">
        <span className="text-sm font-medium text-text-primary">🖥️ Live Viewport</span>
        <div className="flex items-center gap-1">
          <select
            value={intervalSec}
            onChange={(e) => setIntervalSec(Number(e.target.value))}
            className="text-xs bg-boss-card border border-boss-border rounded px-2 py-1 text-text-primary"
          >
            {INTERVAL_OPTIONS.map((s) => (
              <option key={s} value={s}>
                Every {s}s
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded hover:bg-boss-border text-text-muted hover:text-text-primary"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {onClosePiP && (
            <button
              type="button"
              onClick={onClosePiP}
              className="p-1.5 rounded hover:bg-boss-border text-text-muted hover:text-text-primary"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-2 flex flex-col items-center justify-center bg-boss-elevated/30">
        {screenshotUrl ? (
          <div
            className="flex items-center justify-center overflow-auto"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          >
            <img
              src={screenshotUrl}
              alt="UE5 viewport"
              className="max-w-full max-h-[70vh] object-contain rounded-lg border border-boss-border bg-boss-card"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted text-sm">
            <Camera className="w-10 h-10 mb-2 opacity-50" />
            <p>No screenshot yet</p>
            <p className="text-xs mt-1">Execute code or click Capture Now when UE5 is connected</p>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-boss-border flex flex-wrap items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-boss-border"
          onClick={captureNow}
          disabled={!isRelayConnected || capturing}
        >
          {capturing ? (
            <span className="animate-pulse">⏳</span>
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
          📷 Capture Now
        </Button>
        <span className="text-text-muted text-xs">|</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-muted">🔍 Zoom:</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>
        <span className="text-text-muted text-xs ml-auto">
          Last updated: {timeAgo}
          <span className={`ml-2 ${isRelayConnected ? "text-agent-green" : "text-text-muted"}`}>
            {isRelayConnected ? "🟢 Live" : "⚫ Offline"}
          </span>
        </span>
      </div>
    </div>
  );

  return panel;
}
