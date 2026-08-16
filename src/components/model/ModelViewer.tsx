"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, RotateCcw, Info, Loader2 } from "lucide-react";

interface ModelViewerProps {
  modelUrl?: string;
  embedUrl?: string;
  posterUrl: string;
  modelName: string;
}

export function ModelViewer({
  modelUrl,
  embedUrl,
  posterUrl,
  modelName,
}: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(Boolean(modelUrl));
  const [error, setError] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const existingScript = document.querySelector("script[data-model-viewer]");
    if (existingScript) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.type = "module";
    script.src =
      "https://unpkg.com/@google/model-viewer@4.0.0/dist/model-viewer.min.js";
    script.setAttribute("data-model-viewer", "true");
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setError(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el || !scriptLoaded || !modelUrl) return;

    const onLoad = () => setLoading(false);
    const onError = () => {
      setError(true);
      setLoading(false);
    };

    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
    };
  }, [scriptLoaded, modelUrl]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  if (embedUrl) {
    return (
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-black/40 border border-white/5">
        <iframe
          title={modelName}
          src={`${embedUrl}${embedUrl.includes("?") ? "&" : "?"}autostart=1&ui_theme=dark`}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; fullscreen; xr-spatial-tracking"
          allowFullScreen
        />
      </div>
    );
  }

  if (!modelUrl) {
    return (
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-black/40 border border-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={posterUrl}
          alt={modelName}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3 gs-glass rounded-lg px-3 py-1.5 text-xs text-white/60 flex items-center gap-1.5">
          <Info className="w-3 h-3" />
          <span>Preview image</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-square rounded-2xl overflow-hidden bg-black/40 border border-white/5 group"
    >
      {scriptLoaded ? (
        <model-viewer
          ref={(node) => {
            viewerRef.current = node;
          }}
          src={modelUrl}
          poster={posterUrl}
          alt={modelName}
          shadow-intensity="1"
          auto-rotate
          camera-controls
          exposure="0.9"
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "transparent",
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt={modelName}
          className="w-full h-full object-cover"
        />
      )}

      {loading && scriptLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      )}

      {error && (
        <div className="absolute bottom-3 left-3 right-3 gs-glass rounded-lg p-3 text-xs text-white/70 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>3D viewer unavailable — showing preview image</span>
        </div>
      )}

      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-2 rounded-lg gs-glass-strong text-white/80 hover:text-white transition"
          aria-label="Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {scriptLoaded && !loading && !error && (
        <div className="absolute bottom-3 left-3 gs-glass rounded-lg px-3 py-1.5 text-xs text-white/50 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <RotateCcw className="w-3 h-3" />
          <span>Drag to rotate · Scroll to zoom</span>
        </div>
      )}
    </div>
  );
}
