"use client";

import { useState, useRef } from "react";
import { Camera, Upload, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SceneViewerProps {
  projectId: string;
}

export function SceneViewer({ projectId }: SceneViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
      setAnalysis(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imageUrl) return;
    setAnalyzing(true);

    try {
      const res = await fetch("/api/vision/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, imageBase64: imageUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="bg-boss-card border border-boss-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-boss-border">
        <Camera className="w-4 h-4 text-agent-violet" />
        <span className="text-sm font-medium text-text-primary">Scene Viewer</span>
      </div>

      <div className="p-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />

        {imageUrl ? (
          <div className="space-y-3">
            <img
              src={imageUrl}
              alt="UE5 Screenshot"
              className="w-full rounded-lg border border-boss-border"
            />
            <Button
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full bg-agent-violet/10 hover:bg-agent-violet/20 text-agent-violet border border-agent-violet/20 gap-1.5"
            >
              {analyzing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              Analyze Scene
            </Button>
            {analysis && (
              <div className="bg-boss-surface rounded-lg p-3 text-xs text-text-secondary">
                {analysis}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-boss-border rounded-lg p-8 text-center hover:border-boss-border-focus transition-colors"
          >
            <Upload className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-text-secondary text-sm">Upload UE5 screenshot</p>
            <p className="text-text-muted text-xs">Click to browse</p>
          </button>
        )}
      </div>
    </div>
  );
}
