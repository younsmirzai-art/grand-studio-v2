"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  Download,
  ChevronLeft,
  Image as ImageIcon,
  Type,
  ExternalLink,
} from "lucide-react";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { getClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";
import { toast } from "sonner";

const AI_ART_STYLES = [
  { value: "realistic", label: "Realistic" },
  { value: "cartoon", label: "Cartoon" },
  { value: "low_poly", label: "Low Poly" },
  { value: "sculpture", label: "Sculpture" },
  { value: "pbr", label: "PBR" },
] as const;

type Mode = "text" | "image";

interface RecentModel {
  taskId: string;
  label: string;
  modelUrl: string;
  createdAt: number;
}

export default function GeneratePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [mode, setMode] = useState<Mode>("text");
  const [textPrompt, setTextPrompt] = useState("");
  const [artStyle, setArtStyle] = useState("realistic");
  const [imageUrl, setImageUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentModel[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [importProjectId, setImportProjectId] = useState("");
  const [importing, setImporting] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState("");

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsage(data.meshy_generate ?? { used: 0, limit: 3 });
      }
    } catch {}
  }, []);

  // TODO: Re-enable plan check after testing
  useEffect(() => {
    const auth = createAuthClient();
    auth.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/auth/login?redirectTo=/generate");
        return;
      }
      setUser({ id: data.user.id });
    });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const supabase = getClient();
    supabase
      .from("projects")
      .select("id, name, created_at")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setProjects((data as Project[]) ?? []));
  }, [user]);

  useEffect(() => {
    if (user) fetchUsage();
  }, [user, fetchUsage]);

  const startGeneration = useCallback(async (m: Mode) => {
    if (m === "text") {
      if (!textPrompt.trim()) return;
      setMode("text");
      setGenerating(true);
      setTaskId(null);
      setStatus(null);
      setProgress(null);
      setModelUrl(null);
      try {
        const res = await fetch("/api/meshy/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ prompt: textPrompt.trim(), artStyle, type: "text" }),
        });
        const data = await res.json();
        if (res.status === 403 && data.limitReached) {
          setUpgradeModalMessage(data.error ?? "Daily limit reached.");
          setUpgradeModalOpen(true);
          setGenerating(false);
          return;
        }
        if (!res.ok) throw new Error(data.error ?? "Failed to start");
        setTaskId(data.taskId);
        fetchUsage();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to start");
        setGenerating(false);
      }
    } else {
      if (!imageUrl.trim()) {
        toast.error("Enter an image URL");
        return;
      }
      setMode("image");
      setGenerating(true);
      setTaskId(null);
      setStatus(null);
      setProgress(null);
      setModelUrl(null);
      try {
        const res = await fetch("/api/meshy/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ type: "image", imageUrl: imageUrl.trim() }),
        });
        const data = await res.json();
        if (res.status === 403 && data.limitReached) {
          setUpgradeModalMessage(data.error ?? "Daily limit reached.");
          setUpgradeModalOpen(true);
          setGenerating(false);
          return;
        }
        if (!res.ok) throw new Error(data.error ?? "Failed to start");
        setTaskId(data.taskId);
        fetchUsage();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to start");
        setGenerating(false);
      }
    }
  }, [textPrompt, artStyle, imageUrl, fetchUsage]);

  useEffect(() => {
    if (!taskId || !generating) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/meshy/status?taskId=${encodeURIComponent(taskId)}`, {
          credentials: "include",
        });
        const data = await res.json();
        setStatus(data.status ?? null);
        setProgress(data.progress ?? null);
        if (data.status === "SUCCEEDED" && data.modelUrl) {
          setModelUrl(data.modelUrl);
          setGenerating(false);
          const label = mode === "text" ? textPrompt : "Image to 3D";
          setRecent((prev) => [
            { taskId, label: label.slice(0, 60), modelUrl: data.modelUrl, createdAt: Date.now() },
            ...prev.slice(0, 19),
          ]);
          fetchUsage();
        }
        if (data.status === "FAILED") {
          setGenerating(false);
          toast.error("Generation failed");
        }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [taskId, generating, mode, textPrompt, fetchUsage]);

  const handleImport = useCallback(async () => {
    if (!taskId || !importProjectId) {
      toast.error("Select a project");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/meshy/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ taskId, projectId: importProjectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      toast.success("Import queued. Open your project in Grand Studio to run it in UE5.");
      router.push(`/project/${importProjectId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [taskId, importProjectId, router]);

  if (user === null) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2196F3]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(33,150,243,0.15),transparent)] pointer-events-none" />
      <header className="relative border-b border-white/5 bg-[#111114]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-[#606068] hover:text-white transition"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
            <span className="text-[#2A2A30]">|</span>
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2196F3]" />
              Grand Studio AI 3D Generator
            </span>
          </div>
        </div>
      </header>

      <main className="relative max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white flex items-center justify-center gap-3 mb-2">
            <Sparkles className="w-10 h-10 text-[#2196F3]" />
            AI 3D Generator
          </h1>
          <p className="text-lg text-[#A0A0A8]">Create any 3D model with AI</p>
          {usage !== null && (
            <p className="text-sm text-[#606068] mt-2">
              Models generated today: <span className="text-white font-medium">{usage.used}/{usage.limit}</span>
            </p>
          )}
        </div>

        {upgradeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setUpgradeModalOpen(false)}>
            <div className="rounded-2xl border border-white/10 bg-[#111114] p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-white mb-2">Daily limit reached</h3>
              <p className="text-sm text-[#A0A0A8] mb-4">{upgradeModalMessage}</p>
              <div className="flex gap-3">
                <a
                  href="/#pricing"
                  className="flex-1 text-center py-2.5 rounded-lg bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white text-sm font-semibold hover:brightness-110 transition"
                >
                  Upgrade
                </a>
                <button
                  type="button"
                  onClick={() => setUpgradeModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* MODE 1 — Text to 3D */}
          <div className="rounded-2xl border border-white/10 bg-[#111114]/80 backdrop-blur-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Type className="w-5 h-5 text-[#2196F3]" />
              <h2 className="text-lg font-semibold text-white">Text to 3D</h2>
            </div>
            <textarea
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              placeholder="Describe what to create… (e.g. a medieval sword, a treasure chest, a futuristic helmet)"
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/10 text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/50 transition resize-none text-sm mb-4"
            />
            <div className="mb-4">
              <label className="block text-[10px] font-medium text-[#606068] uppercase tracking-wider mb-1.5">
                Art style
              </label>
              <select
                value={artStyle}
                onChange={(e) => setArtStyle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/10 text-white outline-none focus:border-[#2196F3]/50 transition text-sm"
              >
                {AI_ART_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => startGeneration("text")}
              disabled={generating || !textPrompt.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating && taskId && mode === "text" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>Generate 3D Model</>
              )}
            </button>
          </div>

          {/* MODE 2 — Image to 3D */}
          <div className="rounded-2xl border border-white/10 bg-[#111114]/80 backdrop-blur-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="w-5 h-5 text-[#2196F3]" />
              <h2 className="text-lg font-semibold text-white">Image to 3D</h2>
            </div>
            <div className="mb-4">
              <label className="block text-[10px] font-medium text-[#606068] uppercase tracking-wider mb-1.5">
                Image URL
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Paste image URL (e.g. https://…)"
                className="w-full px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/10 text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/50 transition text-sm"
              />
              <p className="text-[10px] text-[#606068] mt-1.5">Public image link. Drag and drop not yet supported.</p>
            </div>
            <button
              type="button"
              onClick={() => startGeneration("image")}
              disabled={generating || !imageUrl.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating && taskId && mode === "image" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>Generate from Image</>
              )}
            </button>
          </div>
        </div>

        {/* Progress */}
        {generating && taskId && (
          <div className="rounded-2xl border border-[#2196F3]/20 bg-[#111114]/80 p-6 mb-8">
            <p className="text-sm font-medium text-white mb-2">Creating your model… This takes 1–2 minutes.</p>
            <div className="h-2 rounded-full bg-[#1A1A1F] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#2196F3] to-[#00BCD4] transition-all duration-500"
                style={{ width: `${progress ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-[#606068] mt-2">Status: {status ?? "Starting…"}</p>
          </div>
        )}

        {/* Result */}
        {modelUrl && !generating && (
          <div className="rounded-2xl border border-[#2196F3]/20 bg-[#111114]/80 p-6 mb-8">
            <h3 className="text-sm font-semibold text-white mb-3">Your model is ready</h3>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-32 h-32 rounded-xl bg-[#1A1A1F] border border-white/5 flex items-center justify-center shrink-0">
                <Sparkles className="w-10 h-10 text-[#2196F3]/50" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#A0A0A8] mb-2 truncate">{mode === "text" ? textPrompt : "Image to 3D"}</p>
                <a
                  href={modelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[#2196F3] hover:underline mb-4"
                >
                  <Download className="w-4 h-4" />
                  Download GLB
                </a>
                <div className="flex flex-wrap gap-3 items-center">
                  <select
                    value={importProjectId}
                    onChange={(e) => setImportProjectId(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-[#0A0A0B] border border-white/10 text-white text-sm outline-none focus:border-[#2196F3]/50"
                  >
                    <option value="">Select project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={importing || !importProjectId}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2196F3] text-white text-sm font-semibold hover:bg-[#2196F3]/90 transition disabled:opacity-50"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                    Import to UE5
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recently Generated */}
        {recent.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Recently Generated</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {recent.map((r) => (
                <div
                  key={r.taskId}
                  className="rounded-xl border border-white/5 bg-[#111114]/80 p-4 hover:border-[#2196F3]/20 transition"
                >
                  <div className="w-full aspect-square rounded-lg bg-[#1A1A1F] flex items-center justify-center mb-2">
                    <Sparkles className="w-8 h-8 text-[#2196F3]/40" />
                  </div>
                  <p className="text-xs text-white truncate mb-1" title={r.label}>{r.label}</p>
                  <a
                    href={r.modelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#2196F3] hover:underline"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
