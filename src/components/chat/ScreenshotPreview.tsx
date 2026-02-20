"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Camera, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScreenshotPreviewProps {
  url: string;
  timestamp?: string;
  codePreview?: string;
  success?: boolean;
  projectId?: string;
  originalCode?: string;
  executionResult?: string;
}

export function ScreenshotPreview({
  url,
  timestamp,
  codePreview,
  success = true,
  projectId,
  originalCode,
  executionResult,
}: ScreenshotPreviewProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const handleReview = async (agentName: string) => {
    if (!projectId) return;
    setReviewing(true);
    try {
      const res = await fetch("/api/agents/visual-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          agentName,
          screenshotUrl: url,
          originalCode,
          executionResult,
        }),
      });
      if (!res.ok) throw new Error("Review failed");
      // New chat turn will appear via realtime subscription
    } catch {
      setReviewing(false);
    }
  };

  const borderGlow = success
    ? "ring-2 ring-agent-green/40 shadow-lg shadow-agent-green/10"
    : "ring-2 ring-red-500/40 shadow-lg shadow-red-500/10";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg overflow-hidden ${borderGlow} bg-boss-elevated/50`}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-boss-border bg-boss-elevated">
        <Camera className="w-3.5 h-3.5 text-agent-teal" />
        <span className="text-[11px] text-text-muted font-medium">
          📸 Live Vision
        </span>
        {timestamp && (
          <span className="text-[10px] text-text-muted ml-auto">
            {new Date(timestamp).toLocaleTimeString()}
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px] gap-1"
          onClick={() => window.open(url, "_blank")}
        >
          <ExternalLink className="w-3 h-3" />
          View Full Size
        </Button>
        {projectId && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px] gap-1 text-agent-rose hover:text-agent-rose"
            onClick={() => handleReview("Morgan")}
            disabled={reviewing}
          >
            <Eye className="w-3 h-3" />
            {reviewing ? "Reviewing…" : "Ask Morgan"}
          </Button>
        )}
      </div>

      <div className="relative aspect-video bg-boss-surface">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-sm">
            Failed to load image
          </div>
        ) : (
          <>
            <img
              src={url}
              alt="UE5 viewport screenshot"
              className={`w-full h-full object-contain transition-opacity duration-300 ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
            />
            {!loaded && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-agent-teal/30 border-t-agent-teal rounded-full animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {codePreview && (
        <div className="px-3 py-2 border-t border-boss-border">
          <p className="text-[10px] text-text-muted truncate font-mono">
            {codePreview}
          </p>
        </div>
      )}
    </motion.div>
  );
}
