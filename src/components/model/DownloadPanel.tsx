"use client";

import { useState } from "react";
import { Download, Check, Loader2, Lock } from "lucide-react";
import {
  getPolyHavenFormatSize,
  pickPolyHavenFormatEntry,
  type PolyHavenFiles,
  type PolyHavenMeshFormat,
} from "@/lib/polyhaven/client";

interface DownloadPanelProps {
  files?: PolyHavenFiles | null;
  modelName: string;
  modelId: string;
}

interface FormatOption {
  key: PolyHavenMeshFormat;
  label: string;
  description: string;
  extension: string;
}

const FORMATS: FormatOption[] = [
  {
    key: "gltf",
    label: "GLTF / GLB",
    description: "Best for web & Blender",
    extension: "gltf",
  },
  {
    key: "fbx",
    label: "FBX",
    description: "Autodesk, Unreal, Unity",
    extension: "fbx",
  },
  {
    key: "usd",
    label: "USD / USDZ",
    description: "Pixar, Apple AR",
    extension: "usd",
  },
  {
    key: "blend",
    label: "Blender",
    description: "Native .blend file",
    extension: "blend",
  },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DownloadPanel({ files, modelName, modelId }: DownloadPanelProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());

  const availableFormats = FORMATS.filter(
    (f) => pickPolyHavenFormatEntry(files, f.key, "1k") !== null
  );

  const handleDownload = async (format: FormatOption) => {
    const picked = pickPolyHavenFormatEntry(files, format.key, "1k");
    if (!picked) return;

    setDownloading(format.key);

    try {
      await fetch("/api/download/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, format: format.key }),
      }).catch(() => {});

      const link = document.createElement("a");
      link.href = picked.entry.url;
      link.download = `${modelName.replace(/\s+/g, "_")}.${format.extension}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloaded((prev) => new Set(prev).add(format.key));
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setTimeout(() => setDownloading(null), 500);
    }
  };

  if (availableFormats.length === 0) {
    return (
      <div className="gs-card p-5">
        <div className="text-center py-6">
          <Lock className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/60">No downloadable files available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gs-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white text-sm">Download</h3>
        <span className="text-xs text-white/40">
          {availableFormats.length} format
          {availableFormats.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-2">
        {availableFormats.map((format) => {
          const picked = pickPolyHavenFormatEntry(files, format.key, "1k");
          if (!picked) return null;

          const isDownloading = downloading === format.key;
          const isDownloaded = downloaded.has(format.key);
          const size = getPolyHavenFormatSize(picked.entry);

          return (
            <button
              key={format.key}
              type="button"
              onClick={() => handleDownload(format)}
              disabled={isDownloading}
              className="gs-format-btn"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  ) : isDownloaded ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Download className="w-4 h-4 text-white/70" />
                  )}
                </div>
                <div className="text-left">
                  <div className="gs-format-name">{format.label}</div>
                  <div className="gs-format-meta">
                    {format.description} · {picked.resolution.toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/60">{formatFileSize(size)}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 text-xs text-white/40">
        <div className="flex items-center gap-1.5">
          <Check className="w-3 h-3 text-green-400" />
          <span>All files are CC0 — free for any use</span>
        </div>
      </div>
    </div>
  );
}
