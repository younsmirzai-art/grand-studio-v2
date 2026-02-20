"use client";

import { useState, useCallback, useEffect } from "react";
import { Play, Square, Save, RefreshCw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playMusicFromCode, stopMusic } from "@/lib/music/musicEngine";

interface MusicPlayerProps {
  title: string;
  description?: string;
  code: string;
  projectId?: string;
  onSave?: (title: string, code: string, mood: string) => void | Promise<void>;
  onRegenerate?: () => void | Promise<void>;
}

export function MusicPlayer({ title, description, code, projectId, onSave, onRegenerate }: MusicPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePlay = useCallback(async () => {
    setError(null);
    try {
      await stopMusic();
      await playMusicFromCode(code);
      setPlaying(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Playback failed");
      setPlaying(false);
    }
  }, [code]);

  const handleStop = useCallback(async () => {
    await stopMusic();
    setPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      stopMusic();
    };
  }, []);

  // Volume: Tone.js master volume is in decibels (optional)
  useEffect(() => {
    if (typeof window === "undefined") return;
    import("tone").then((ToneModule) => {
      const Tone = "default" in ToneModule ? (ToneModule as { default: { getDestination: () => unknown } }).default : ToneModule;
      const dest = Tone.getDestination?.();
      if (dest && typeof dest === "object" && "volume" in dest) {
        const v = (dest as { volume: { value: number } }).volume;
        if (v && typeof v.value === "number") v.value = volume >= 100 ? 0 : (volume / 100 - 1) * 40;
      }
    });
  }, [volume]);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(title, code, "custom");
    } finally {
      setSaving(false);
    }
  }, [title, code, onSave]);

  return (
    <div className="rounded-xl border border-boss-border bg-boss-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎵</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text-primary truncate">{title}</p>
          {description && <p className="text-xs text-text-muted truncate">{description}</p>}
        </div>
      </div>

      {/* Waveform bars (CSS animation when playing) */}
      <div className="flex items-end gap-0.5 h-8">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`w-1 rounded-full bg-[#E91E63]/60 ${
              playing ? "animate-music-bar" : ""
            }`}
            style={{
              height: "40%",
              animationDelay: `${i * 0.05}s`,
              animationDuration: "0.5s",
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {playing ? (
          <Button size="sm" variant="outline" onClick={handleStop} className="gap-1.5 border-agent-rose/30 text-agent-rose hover:bg-agent-rose/10">
            <Square className="w-3.5 h-3.5" />
            Stop
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={handlePlay} className="gap-1.5 border-[#E91E63]/30 text-[#E91E63] hover:bg-[#E91E63]/10">
            <Play className="w-3.5 h-3.5" />
            Play
          </Button>
        )}

        <div className="flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-text-muted" />
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-20 h-1.5 rounded-full accent-[#E91E63]"
          />
        </div>

        {onSave && projectId && (
          <Button size="sm" variant="ghost" onClick={handleSave} disabled={saving} className="gap-1.5 text-text-muted hover:text-text-primary">
            {saving ? "…" : "💾"}
            Save to Project
          </Button>
        )}
        {onRegenerate && (
          <Button size="sm" variant="ghost" onClick={onRegenerate} className="gap-1.5 text-text-muted hover:text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-agent-rose">{error}</p>}
    </div>
  );
}
