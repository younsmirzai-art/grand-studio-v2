"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Camera, Maximize2, X } from "lucide-react";

interface ViewportPanelProps {
  screenshotUrl: string | null;
  screenshotTime: string | null;
  visionScore: number | null;
  onCapture: () => void;
}

export function ViewportPanel({
  screenshotUrl,
  screenshotTime,
  visionScore,
  onCapture,
}: ViewportPanelProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const scoreColor =
    visionScore !== null
      ? visionScore >= 8
        ? "text-emerald-400"
        : visionScore >= 5
        ? "text-amber-400"
        : "text-red-400"
      : "";

  return (
    <>
      <div className="flex flex-col h-full bg-[#0A0A0B] relative overflow-hidden">
        {!screenshotUrl ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 epic-dot-grid opacity-20" />
            <div className="relative z-10 text-center">
              <Monitor className="w-16 h-16 text-[#2A2A30] mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-[#2A2A30] uppercase tracking-widest mb-2">
                UE5 Viewport
              </h3>
              <p className="text-sm text-[#606068] mb-2">
                Use the AI Co-Pilot to build your first scene
              </p>
              <p className="text-xs text-[#2196F3]">
                Press Ctrl+K to open AI Co-Pilot
              </p>
            </div>
          </div>
        ) : (
          /* Screenshot View */
          <div className="flex-1 relative group">
            <AnimatePresence mode="wait">
              <motion.img
                key={screenshotUrl}
                src={screenshotUrl}
                alt="UE5 Viewport"
                className="w-full h-full object-contain"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            </AnimatePresence>

            {/* Gradient overlays */}
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

            {/* Score badge */}
            {visionScore !== null && (
              <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm">
                <span className={`text-sm font-bold ${scoreColor}`}>
                  Score: {visionScore}/10
                </span>
              </div>
            )}

            {/* Controls overlay */}
            <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={onCapture}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-medium hover:bg-black/80 transition"
              >
                <Camera className="w-3.5 h-3.5" />
                Capture
              </button>
              <button
                onClick={() => setFullscreen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-medium hover:bg-black/80 transition"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Timestamp */}
            {screenshotTime && (
              <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/60 backdrop-blur-sm">
                <span className="text-[10px] text-[#A0A0A8]">
                  {new Date(screenshotTime).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Quick Build Bar */}
        <QuickBuildBar />
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {fullscreen && screenshotUrl && (
          <motion.div
            className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFullscreen(false)}
          >
            <button
              onClick={() => setFullscreen(false)}
              className="absolute top-6 right-6 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={screenshotUrl}
              alt="UE5 Viewport Full"
              className="max-w-full max-h-full object-contain rounded-xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function QuickBuildBar() {
  return null;
}
