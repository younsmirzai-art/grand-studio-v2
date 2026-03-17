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
  Paintbrush,
  FileImage,
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

const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
] as const;

type TabId = "text" | "image" | "texture" | "text-to-image";
type TaskMode = "text" | "image" | "texture" | "text-to-image";

interface RecentModel {
  taskId: string;
  label: string;
  modelUrl: string;
  createdAt: number;
}

interface GeneratedModelRow {
  id: string;
  task_id: string;
  prompt: string | null;
  status: string;
  model_url: string | null;
  thumbnail_url: string | null;
  art_style: string | null;
  mode: string;
  created_at: string;
  completed_at: string | null;
}

export default function GeneratePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("text");
  const [mode, setMode] = useState<TaskMode>("text");
  const [taskMode, setTaskMode] = useState<TaskMode>("text");
  const [textPrompt, setTextPrompt] = useState("");
  const [artStyle, setArtStyle] = useState("realistic");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [textureModelUrl, setTextureModelUrl] = useState("");
  const [textureModelUploading, setTextureModelUploading] = useState(false);
  const [texturePrompt, setTexturePrompt] = useState("");
  const [textToImagePrompt, setTextToImagePrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [generating, setGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentModel[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [importProjectId, setImportProjectId] = useState("");
  const [importing, setImporting] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [plan, setPlan] = useState<"free" | "pro" | "team" | "unknown">("unknown");
  const [models, setModels] = useState<GeneratedModelRow[]>([]);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState("");

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsage(data.meshy_generate ?? { used: 0, limit: 0 });
        setPlan((data.plan as "free" | "pro" | "team") ?? "free");
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

  useEffect(() => {
    if (user) fetchModels();
  }, [user, fetchModels]);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/meshy/my-models", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setModels((data.models as GeneratedModelRow[]) ?? []);
    } catch {
      // ignore
    }
  }, []);

  const uploadImage = useCallback(async (file: File) => {
    setImageUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/meshy/upload-image", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setImageUrl(data.url);
      setImagePreview(URL.createObjectURL(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setImageUploading(false);
    }
  }, []);

  const uploadTextureModel = useCallback(async (file: File) => {
    setTextureModelUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/meshy/upload-model", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setTextureModelUrl(data.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setTextureModelUploading(false);
    }
  }, []);

  const startGeneration = useCallback(async (m: TaskMode) => {
    if (m === "text") {
      if (!textPrompt.trim()) return;
      setMode("text");
      setTaskMode("text");
      setGenerating(true);
      setTaskId(null);
      setStatus(null);
      setProgress(null);
      setModelUrl(null);
      setResultImageUrl(null);
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
    } else if (m === "image") {
      if (!imageUrl.trim()) {
        toast.error("Upload an image or paste a URL");
        return;
      }
      setMode("image");
      setTaskMode("image");
      setGenerating(true);
      setTaskId(null);
      setStatus(null);
      setProgress(null);
      setModelUrl(null);
      setResultImageUrl(null);
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
    } else if (m === "texture") {
      if (!textureModelUrl.trim() || !texturePrompt.trim()) {
        toast.error("Provide a model URL and texture description");
        return;
      }
      setMode("texture");
      setTaskMode("texture");
      setGenerating(true);
      setTaskId(null);
      setStatus(null);
      setProgress(null);
      setModelUrl(null);
      setResultImageUrl(null);
      try {
        const res = await fetch("/api/meshy/texture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ modelUrl: textureModelUrl.trim(), prompt: texturePrompt.trim() }),
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
      if (!textToImagePrompt.trim()) return;
      setMode("text-to-image");
      setTaskMode("text-to-image");
      setGenerating(true);
      setTaskId(null);
      setStatus(null);
      setProgress(null);
      setModelUrl(null);
      setResultImageUrl(null);
      try {
        const res = await fetch("/api/meshy/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            type: "text-to-image",
            prompt: textToImagePrompt.trim(),
            aspectRatio,
          }),
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
  }, [textPrompt, artStyle, imageUrl, textureModelUrl, texturePrompt, textToImagePrompt, aspectRatio, fetchUsage]);

  useEffect(() => {
    if (!taskId || !generating) return;
    const modeParam = taskMode === "texture" ? "texture" : taskMode === "text-to-image" ? "text-to-image" : taskMode === "image" ? "image" : undefined;
    const url = modeParam
      ? `/api/meshy/status?taskId=${encodeURIComponent(taskId)}&mode=${modeParam}`
      : `/api/meshy/status?taskId=${encodeURIComponent(taskId)}`;
    const poll = async () => {
      try {
        const res = await fetch(url, { credentials: "include" });
        const data = await res.json();
        setStatus(data.status ?? null);
        setProgress(data.progress ?? null);
        if (data.status === "SUCCEEDED") {
          if (data.modelUrl) {
            setModelUrl(data.modelUrl);
            const label =
              taskMode === "text"
                ? textPrompt
                : taskMode === "image"
                  ? "Image to 3D"
                  : taskMode === "texture"
                    ? texturePrompt
                    : textToImagePrompt;
            setRecent((prev) => [
              { taskId, label: String(label).slice(0, 60), modelUrl: data.modelUrl, createdAt: Date.now() },
              ...prev.slice(0, 19),
            ]);
          }
          if (data.imageUrl) setResultImageUrl(data.imageUrl);
          setGenerating(false);
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
  }, [taskId, generating, taskMode, textPrompt, texturePrompt, textToImagePrompt, fetchUsage]);

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
        body: JSON.stringify({
          taskId,
          projectId: importProjectId,
          mode: taskMode,
        }),
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
  }, [taskId, importProjectId, taskMode, router]);

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

        {plan === "free" && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70">
            <div className="rounded-2xl border border-white/10 bg-[#111114] p-6 max-w-md w-full shadow-xl text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#2196F3]/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-[#2196F3]" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-1">AI 3D Generator — Pro &amp; Team Only</h2>
              <p className="text-xs text-[#A0A0A8] mb-4">
                Create custom 3D models from text or images. Upgrade to Pro ($19/mo) for 3 models per day or Team ($49/mo) for 10 models per day.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
                <a
                  href="/#pricing"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white text-xs font-semibold hover:brightness-110 transition"
                >
                  Upgrade to Pro
                </a>
                <a
                  href="/#pricing"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-white/20 text-white text-xs font-semibold hover:bg-white/10 transition"
                >
                  Upgrade to Team
                </a>
              </div>
              <p className="text-[10px] text-[#606068]">
                You can still explore Grand Studio and AI Co-Pilot on the Free plan.
              </p>
            </div>
          </div>
        )}
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

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-[#111114]/80 border border-white/5 mb-8">
          {(
            [
              { id: "text" as TabId, label: "Text to 3D", icon: Type },
              { id: "image" as TabId, label: "Image to 3D", icon: ImageIcon },
              { id: "texture" as TabId, label: "AI Texturing", icon: Paintbrush },
              { id: "text-to-image" as TabId, label: "Text to Image", icon: FileImage },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === t.id
                  ? "bg-[#2196F3] text-white"
                  : "text-[#A0A0A8] hover:text-white hover:bg-white/5"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111114]/80 backdrop-blur-sm p-6 mb-8">
          {activeTab === "text" && (
            <>
              <textarea
                value={textPrompt}
                onChange={(e) => setTextPrompt(e.target.value)}
                placeholder="Describe what to create… (e.g. a medieval sword, a treasure chest, a futuristic helmet)"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/10 text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/50 transition resize-none text-sm mb-4"
              />
              <div className="mb-4">
                <label className="block text-[10px] font-medium text-[#606068] uppercase tracking-wider mb-1.5">Art style</label>
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
                {generating && taskId && mode === "text" ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <>Generate 3D Model</>}
              </button>
            </>
          )}

          {activeTab === "image" && (
            <>
              <div
                className="mb-4 border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-[#2196F3]/40 transition cursor-pointer"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[#2196F3]/50"); }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-[#2196F3]/50"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-[#2196F3]/50");
                  const f = e.dataTransfer.files[0];
                  if (f && ["image/jpeg", "image/png", "image/webp"].includes(f.type)) uploadImage(f);
                }}
                onClick={() => document.getElementById("image-file-input")?.click()}
              >
                <input
                  id="image-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }}
                />
                {imageUploading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-[#2196F3] mx-auto mb-2" />
                ) : imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="max-h-32 mx-auto rounded-lg mb-2" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-[#606068] mx-auto mb-2" />
                )}
                <p className="text-sm text-[#A0A0A8]">Drag and drop or click to upload JPG, PNG, WebP</p>
              </div>
              <div className="mb-4">
                <label className="block text-[10px] font-medium text-[#606068] uppercase tracking-wider mb-1.5">Or paste image URL</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => { setImageUrl(e.target.value); setImagePreview(null); }}
                  placeholder="https://…"
                  className="w-full px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/10 text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/50 transition text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => startGeneration("image")}
                disabled={generating || !imageUrl.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating && taskId && mode === "image" ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <>Generate from Image</>}
              </button>
            </>
          )}

          {activeTab === "texture" && (
            <>
              <div className="mb-4">
                <label className="block text-[10px] font-medium text-[#606068] uppercase tracking-wider mb-1.5">Model URL or upload GLB/FBX/OBJ</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={textureModelUrl}
                    onChange={(e) => setTextureModelUrl(e.target.value)}
                    placeholder="https://… or upload below"
                    className="flex-1 px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/10 text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/50 transition text-sm"
                  />
                  <label className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-[#A0A0A8] cursor-pointer hover:bg-white/10 shrink-0">
                    {textureModelUploading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Upload"}
                    <input
                      type="file"
                      accept=".glb,.gltf,.obj,.fbx"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTextureModel(f); e.target.value = ""; }}
                    />
                  </label>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-[10px] font-medium text-[#606068] uppercase tracking-wider mb-1.5">Describe the texture (e.g. rusty metal armor, wooden barrel with moss)</label>
                <input
                  type="text"
                  value={texturePrompt}
                  onChange={(e) => setTexturePrompt(e.target.value)}
                  placeholder="Rusty metal armor…"
                  className="w-full px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/10 text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/50 transition text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => startGeneration("texture")}
                disabled={generating || !textureModelUrl.trim() || !texturePrompt.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating && taskId && mode === "texture" ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying textures…</> : <>Apply Textures</>}
              </button>
            </>
          )}

          {activeTab === "text-to-image" && (
            <>
              <textarea
                value={textToImagePrompt}
                onChange={(e) => setTextToImagePrompt(e.target.value)}
                placeholder="Describe the image you want…"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/10 text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/50 transition resize-none text-sm mb-4"
              />
              <div className="mb-4">
                <label className="block text-[10px] font-medium text-[#606068] uppercase tracking-wider mb-1.5">Aspect ratio</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/10 text-white outline-none focus:border-[#2196F3]/50 transition text-sm"
                >
                  {ASPECT_RATIOS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => startGeneration("text-to-image")}
                disabled={generating || !textToImagePrompt.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating && taskId && mode === "text-to-image" ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <>Generate Image</>}
              </button>
            </>
          )}
        </div>

        {/* Progress */}
        {generating && taskId && (
          <div className="rounded-2xl border border-[#2196F3]/20 bg-[#111114]/80 p-6 mb-8">
            <p className="text-sm font-medium text-white mb-2">Creating your {taskMode === "text-to-image" ? "image" : "model"}… This takes 1–2 minutes.</p>
            <div className="h-2 rounded-full bg-[#1A1A1F] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#2196F3] to-[#00BCD4] transition-all duration-500"
                style={{ width: `${progress ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-[#606068] mt-2">Status: {status ?? "Starting…"} {progress != null ? `(${progress}%)` : ""}</p>
          </div>
        )}

        {/* Result — 3D model */}
        {modelUrl && !generating && (
          <div className="rounded-2xl border border-[#2196F3]/20 bg-[#111114]/80 p-6 mb-8">
            <h3 className="text-sm font-semibold text-white mb-3">Your model is ready</h3>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-32 h-32 rounded-xl bg-[#1A1A1F] border border-white/5 flex items-center justify-center shrink-0">
                <Sparkles className="w-10 h-10 text-[#2196F3]/50" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#A0A0A8] mb-2 truncate">
                  {taskMode === "text" ? textPrompt : taskMode === "image" ? "Image to 3D" : taskMode === "texture" ? texturePrompt : ""}
                </p>
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

        {/* Result — Text to Image (image only) */}
        {resultImageUrl && !modelUrl && !generating && (
          <div className="rounded-2xl border border-[#2196F3]/20 bg-[#111114]/80 p-6 mb-8">
            <h3 className="text-sm font-semibold text-white mb-3">Your image is ready</h3>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <img src={resultImageUrl} alt="Generated" className="w-48 h-48 object-cover rounded-xl border border-white/5 shrink-0" />
              <div className="flex-1 min-w-0">
                <a
                  href={resultImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[#2196F3] hover:underline"
                >
                  <Download className="w-4 h-4" />
                  Download image
                </a>
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

        {/* My Models (from Supabase) */}
        {models.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-white mb-4">My Models</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {models.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-white/5 bg-[#111114]/80 p-4 flex flex-col gap-2"
                >
                  <div className="w-full aspect-square rounded-lg bg-[#1A1A1F] border border-white/5 flex items-center justify-center overflow-hidden">
                    {m.thumbnail_url ? (
                      <img
                        src={m.thumbnail_url}
                        alt={m.prompt ?? "Generated model"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Sparkles className="w-8 h-8 text-[#2196F3]/40" />
                    )}
                  </div>
                  <p className="text-xs text-white truncate" title={m.prompt ?? ""}>
                    {m.prompt ?? "Untitled model"}
                  </p>
                  <p className="text-[10px] text-[#606068]">
                    {new Date(m.created_at).toLocaleDateString()}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 items-center">
                    {m.model_url && (
                      <a
                        href={m.model_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] text-[#2196F3] hover:underline"
                      >
                        <Download className="w-3 h-3" />
                        Download GLB
                      </a>
                    )}
                    {m.model_url && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!importProjectId) {
                            toast.error("Select a project above before importing");
                            return;
                          }
                          setImporting(true);
                          try {
                            const res = await fetch("/api/meshy/import", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              credentials: "include",
                              body: JSON.stringify({
                                taskId: m.task_id,
                                projectId: importProjectId,
                                mode: m.mode === "image-to-3d" ? "image" : m.mode === "texture" ? "texture" : "text",
                              }),
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
                        }}
                        disabled={importing || !importProjectId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2196F3] text-white text-[11px] font-semibold hover:bg-[#2196F3]/90 transition disabled:opacity-50"
                      >
                        {importing ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ExternalLink className="w-3 h-3" />
                        )}
                        Import to UE5
                      </button>
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
