"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Music,
  Loader2,
  Download,
  ChevronLeft,
  Play,
  Pause,
} from "lucide-react";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { toast } from "sonner";

const STYLES = [
  { value: "epic_orchestral", label: "Epic / Orchestral" },
  { value: "ambient", label: "Ambient" },
  { value: "electronic", label: "Electronic" },
  { value: "rock", label: "Rock" },
  { value: "jazz", label: "Jazz" },
  { value: "cinematic", label: "Cinematic" },
  { value: "horror", label: "Horror" },
  { value: "fantasy", label: "Fantasy" },
] as const;

const DURATIONS = [
  { value: "30", label: "30 seconds" },
  { value: "60", label: "1 minute" },
  { value: "120", label: "2 minutes" },
] as const;

interface TrackRow {
  id: string;
  task_id: string;
  prompt: string | null;
  style: string | null;
  duration: string | null;
  status: string;
  audio_url: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function MusicPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [duration, setDuration] = useState("60");
  const [generating, setGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!playingUrl || !audioRef.current) return;
    audioRef.current.src = playingUrl;
    audioRef.current.play().catch(() => setPlayingUrl(null));
  }, [playingUrl]);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsage(data.music_generate ?? { used: 0, limit: 0 });
      }
    } catch {}
  }, []);

  const fetchTracks = useCallback(async () => {
    try {
      const res = await fetch("/api/music/my-tracks", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTracks(data.tracks ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const auth = createAuthClient();
    auth.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/auth/login?redirectTo=/music");
        return;
      }
      setUser({ id: data.user.id });
    });
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchUsage();
      fetchTracks();
    }
  }, [user, fetchUsage, fetchTracks]);

  useEffect(() => {
    if (!taskId || !generating) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/music/status?taskId=${encodeURIComponent(taskId)}`, {
          credentials: "include",
        });
        const data = await res.json();
        setProgress(data.progress ?? (data.status === "running" ? 50 : 0));
        if (data.status === "succeeded" && data.audioUrl) {
          setAudioUrl(data.audioUrl);
          setGenerating(false);
          fetchUsage();
          fetchTracks();
        }
        if (data.status === "failed") {
          setGenerating(false);
          toast.error("Music generation failed");
        }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [taskId, generating, fetchUsage, fetchTracks]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("Describe the music you want");
      return;
    }
    setGenerating(true);
    setTaskId(null);
    setProgress(null);
    setAudioUrl(null);
    try {
      const res = await fetch("/api/music/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt: prompt.trim(), style, duration }),
      });
      const data = await res.json();
      if (res.status === 403 && data.limitReached) {
        toast.error(data.error ?? "Daily limit reached");
        setGenerating(false);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to start");
      setTaskId(data.taskId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start");
      setGenerating(false);
    }
  }, [prompt, style, duration]);

  if (user === null) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2196F3]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <audio
        ref={audioRef}
        onEnded={() => setPlayingUrl(null)}
        className="hidden"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(33,150,243,0.12),transparent)] pointer-events-none" />
      <header className="relative border-b border-white/5 bg-[#111114]/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-[#606068] hover:text-white transition"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Dashboard</span>
          </Link>
          <span className="text-sm font-semibold text-white flex items-center gap-2">
            <Music className="w-4 h-4 text-[#2196F3]" />
            Grand Studio AI Music Studio
          </span>
        </div>
      </header>

      <main className="relative max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-white flex items-center justify-center gap-3 mb-2">
            <Music className="w-12 h-12 text-[#2196F3]" />
            AI Music Studio
          </h1>
          <p className="text-lg text-[#A0A0A8]">
            Create soundtrack and sound effects for your UE5 scenes
          </p>
          {usage !== null && (
            <p className="text-sm text-[#606068] mt-2">
              Tracks today: <span className="text-white font-medium">{usage.used}/{usage.limit}</span>
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111114]/80 backdrop-blur-sm p-6 mb-8">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the music you want… (e.g. epic battle theme, calm forest ambience, horror suspense)"
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/10 text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/50 transition resize-none text-sm mb-4"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[10px] font-medium text-[#606068] uppercase tracking-wider mb-1.5">Style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/10 text-white outline-none focus:border-[#2196F3]/50 transition text-sm"
              >
                {STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#606068] uppercase tracking-wider mb-1.5">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/10 text-white outline-none focus:border-[#2196F3]/50 transition text-sm"
              >
                {DURATIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#2196F3] to-[#1976D2] text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Music className="w-4 h-4" />
                Generate Music
              </>
            )}
          </button>
        </div>

        {generating && taskId && (
          <div className="rounded-2xl border border-[#2196F3]/20 bg-[#111114]/80 p-6 mb-8">
            <p className="text-sm font-medium text-white mb-2">Creating your track… This usually takes 30–60 seconds.</p>
            <div className="h-2 rounded-full bg-[#1A1A1F] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#2196F3] to-[#1976D2] transition-all duration-500"
                style={{ width: `${progress ?? 20}%` }}
              />
            </div>
          </div>
        )}

        {audioUrl && !generating && (
          <div className="rounded-2xl border border-[#2196F3]/20 bg-[#111114]/80 p-6 mb-8">
            <h3 className="text-sm font-semibold text-white mb-3">Your track is ready</h3>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-full sm:w-64 rounded-xl bg-[#1A1A1F] border border-white/5 p-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPlayingUrl(playingUrl === audioUrl ? null : audioUrl)}
                  className="w-12 h-12 rounded-full bg-[#2196F3] flex items-center justify-center text-white hover:brightness-110 transition"
                >
                  {playingUrl === audioUrl ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </button>
                <span className="text-xs text-[#A0A0A8]">Preview</span>
              </div>
              <div className="flex-1 min-w-0 flex flex-wrap gap-3">
                <a
                  href={audioUrl}
                  download="grand-studio-track.mp3"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2196F3] text-white text-sm font-semibold hover:bg-[#2196F3]/90 transition"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition"
                >
                  Add to UE5 Project
                </Link>
              </div>
            </div>
          </div>
        )}

        {tracks.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">My Tracks</h2>
            <div className="space-y-3">
              {tracks.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-white/5 bg-[#111114]/80 p-4 flex flex-wrap items-center gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Music className="w-5 h-5 text-[#2196F3]/70 shrink-0" />
                    <p className="text-sm text-white truncate" title={t.prompt ?? ""}>
                      {t.prompt ?? "Untitled track"}
                    </p>
                    {t.status === "completed" && (
                      <span className="text-[10px] text-emerald-400 shrink-0">Done</span>
                    )}
                    {(t.status === "pending" || t.status === "running") && (
                      <span className="text-[10px] text-amber-400 shrink-0">Generating…</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {t.audio_url && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPlayingUrl(playingUrl === t.audio_url ? null : t.audio_url)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
                        >
                          {playingUrl === t.audio_url ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <a
                          href={t.audio_url}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-[#2196F3] text-white hover:brightness-110 transition"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
