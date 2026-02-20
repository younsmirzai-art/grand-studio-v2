"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/lib/stores/projectStore";
import { useParams } from "next/navigation";

interface LiveViewPanelProps {
  /** When true, panel fills container (e.g. building view right column) */
  embedded?: boolean;
}

export function LiveViewPanel({ embedded }: LiveViewPanelProps = {}) {
  const params = useParams();
  const projectId = params?.id as string | undefined;
  const ue5Commands = useProjectStore((s) => s.ue5Commands);
  const isRelayConnected = useProjectStore((s) => s.isRelayConnected);
  const [capturing, setCapturing] = useState(false);

  const latestWithScreenshot = ue5Commands.find(
    (c) => c.screenshot_url && (c.status === "success" || c.status === "error")
  );
  const screenshotUrl = latestWithScreenshot?.screenshot_url ?? null;

  const handleCaptureNow = async () => {
    if (!projectId) return;
    setCapturing(true);
    try {
      const res = await fetch("/api/ue5/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error("Capture failed");
    } catch {
      // ignore
    } finally {
      setCapturing(false);
    }
  };

  return (
    <motion.div
      initial={embedded ? undefined : { width: 0, opacity: 0 }}
      animate={embedded ? { opacity: 1 } : { width: 280, opacity: 1 }}
      exit={embedded ? undefined : { width: 0, opacity: 0 }}
      className={`overflow-hidden border-boss-border bg-boss-surface flex flex-col ${embedded ? "w-full h-full border-l" : "shrink-0 border-l w-[280px]"}`}
    >
      <div className="px-3 py-2 border-b border-boss-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-agent-teal" />
          <span className="text-sm font-medium text-text-primary">🖥️ Live View</span>
        </div>
        <div className="flex items-center gap-1">
          {isRelayConnected ? (
            <Wifi className="w-3 h-3 text-agent-green" />
          ) : (
            <WifiOff className="w-3 h-3 text-text-muted" />
          )}
        </div>
      </div>

      <div className="p-2 flex-shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2 border-boss-border"
          onClick={handleCaptureNow}
          disabled={!projectId || !isRelayConnected || capturing}
        >
          {capturing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
          📸 Capture Now
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-2">
        {screenshotUrl ? (
          <div className="space-y-2">
            <img
              src={screenshotUrl}
              alt="UE5 viewport"
              className="w-full rounded-lg border border-boss-border object-contain bg-boss-elevated"
            />
            <p className="text-[10px] text-text-muted">
              Latest capture • Auto-refreshes
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-center text-text-muted text-sm">
            <Camera className="w-8 h-8 mb-2 opacity-50" />
            <p>No screenshot yet</p>
            <p className="text-xs mt-1">
              Execute code or click Capture Now when UE5 is connected
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
