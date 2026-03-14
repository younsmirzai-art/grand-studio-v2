"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Search,
  Box,
  Lamp,
  Paintbrush,
  Flame,
  Shapes,
  Sparkles,
  Clock,
  Trash2,
  Check,
  Copy,
  ChevronRight,
  Terminal,
  Filter,
  Globe,
  Download,
  Image,
  Sun,
  Loader2,
  TreePine,
  ExternalLink,
} from "lucide-react";
import { ASSET_CATALOG, type AssetEntry } from "@/lib/ue5/assetLibrary";
import { generateUE5ImportCode } from "@/lib/ue5/importCode";
import { SCENE_TEMPLATES } from "@/lib/ue5/sceneTemplates";
import type { UE5Command, GodEyeEntry } from "@/lib/types";
import { toast } from "sonner";

interface WorkspacePanelProps {
  ue5Commands: UE5Command[];
  godEyeLog: GodEyeEntry[];
  onAssetClick: (asset: AssetEntry) => void;
  onTemplateClick: (name: string, description: string) => void;
  onClearScene: () => void;
  projectId: string;
}

const CATEGORIES = [
  { id: "All", icon: Shapes },
  { id: "Architecture", icon: Box },
  { id: "Props", icon: Lamp },
  { id: "Materials", icon: Paintbrush },
  { id: "BasicShapes", icon: Shapes },
  { id: "Particles", icon: Flame },
];

const ASSET_ICON_MAP: Record<string, typeof Box> = {
  Architecture: Box,
  Props: Lamp,
  Materials: Paintbrush,
  BasicShapes: Shapes,
  Particles: Flame,
};

const TEMPLATES = Object.entries(SCENE_TEMPLATES).map(([key, t]) => ({
  key,
  name: t.name,
  description: t.description,
  time: "~30s",
}));

type TabId = "starter" | "polyhaven" | "sketchfab" | "templates" | "scene" | "history";

interface PHResult {
  id: string;
  name: string;
  type: string;
  categories: string[];
  tags: string[];
  downloadCount: number;
  thumbnailUrl: string;
}

interface SFResult {
  uid: string;
  name: string;
  author: string;
  thumbnailUrl: string | null;
  viewCount: number;
  license: string;
  faceCount: number;
}

export function WorkspacePanel({
  ue5Commands,
  godEyeLog,
  onAssetClick,
  onTemplateClick,
  onClearScene,
  projectId,
}: WorkspacePanelProps) {
  const [tab, setTab] = useState<TabId>("starter");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [historyFilter, setHistoryFilter] = useState<string | null>(null);
  const [expandedCmd, setExpandedCmd] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Poly Haven state
  const [phQuery, setPhQuery] = useState("");
  const [phSubTab, setPhSubTab] = useState<"models" | "textures" | "hdris">("models");
  const [phResults, setPhResults] = useState<PHResult[]>([]);
  const [phLoading, setPhLoading] = useState(false);
  const [phDownloading, setPhDownloading] = useState<string | null>(null);
  const [phImportedId, setPhImportedId] = useState<string | null>(null);

  // Sketchfab state
  const [sfQuery, setSfQuery] = useState("");
  const [sfResults, setSfResults] = useState<SFResult[]>([]);
  const [sfLoading, setSfLoading] = useState(false);
  const [sfDownloading, setSfDownloading] = useState<string | null>(null);
  const [sfImportedId, setSfImportedId] = useState<string | null>(null);

  const filteredAssets = useMemo(() => {
    let list = ASSET_CATALOG;
    if (category !== "All") list = list.filter((a) => a.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [category, search]);

  const filteredHistory = useMemo(() => {
    if (!historyFilter) return godEyeLog.slice().reverse();
    return godEyeLog
      .filter((e) => {
        if (historyFilter === "ai") return e.event_type === "api_call" || e.event_type === "api_ok" || e.event_type === "turn";
        if (historyFilter === "ue5") return e.event_type === "execution" || e.event_type === "screenshot";
        if (historyFilter === "error") return e.event_type === "error";
        return true;
      })
      .slice()
      .reverse();
  }, [godEyeLog, historyFilter]);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const eventColor = (type: string) => {
    if (type === "api_call" || type === "api_ok" || type === "turn") return "bg-[#2196F3]";
    if (type === "execution" || type === "screenshot") return "bg-emerald-500";
    if (type === "error") return "bg-red-500";
    if (type === "boss") return "bg-[#00BCD4]";
    return "bg-[#606068]";
  };

  // Poly Haven search
  const searchPolyHaven = useCallback(async () => {
    if (!phQuery.trim()) return;
    setPhLoading(true);
    try {
      const res = await fetch("/api/polyhaven/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: phQuery, type: phSubTab, count: 20 }),
      });
      const data = await res.json();
      setPhResults(data.results ?? []);
    } catch {
      toast.error("Poly Haven search failed");
    }
    setPhLoading(false);
  }, [phQuery, phSubTab]);

  const downloadPolyHaven = useCallback(async (assetId: string, type: string, displayName: string) => {
    setPhDownloading(assetId);
    const requestType = type === "hdris" ? "hdri" : type === "textures" ? "texture" : "model";
    try {
      const res = await fetch("/api/polyhaven/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, type: requestType, projectId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = data?.error ?? `HTTP ${res.status}`;
        console.error("[Import Poly Haven] Download API error:", reason, data);
        setPhDownloading(null);
        toast.error(`Import failed: ${reason}`);
        return;
      }
      if (!data.url) {
        const reason = data?.error ?? "No URL in response";
        console.error("[Import Poly Haven] No url in response:", data);
        setPhDownloading(null);
        toast.error(`Import failed: ${reason}`);
        return;
      }
      const ext = data.url.endsWith(".glb") ? "glb" : "gltf";
      const filename = `${assetId}.${ext}`;
      const label = (displayName || assetId).replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
      let code: string;
      try {
        code = generateUE5ImportCode(data.url, filename, label);
      } catch (e) {
        console.error("[Import Poly Haven] generateUE5ImportCode failed:", e);
        setPhDownloading(null);
        toast.error("Import failed: could not generate import code");
        return;
      }
      const execRes = await fetch("/api/ue5/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, code }),
      });
      const execData = await execRes.json().catch(() => ({}));
      if (!execRes.ok || !execData.commandId) {
        const reason = execData?.error ?? `HTTP ${execRes.status}`;
        console.error("[Import Poly Haven] UE5 execute error:", reason, execData);
        setPhDownloading(null);
        toast.error(`Import failed: ${reason}`);
        return;
      }
      const name = displayName || assetId.replace(/_/g, " ");
      toast.success(`${name} imported to UE5!`);
      setPhImportedId(assetId);
      setTimeout(() => setPhImportedId(null), 3000);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[Import Poly Haven] Error:", e);
      setPhDownloading(null);
      toast.error(`Import failed: ${message}`);
    } finally {
      setPhDownloading(null);
    }
  }, [projectId]);

  // Sketchfab search
  const searchSketchfab = useCallback(async () => {
    if (!sfQuery.trim()) return;
    setSfLoading(true);
    try {
      const res = await fetch("/api/sketchfab/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sfQuery, count: 12 }),
      });
      const data = await res.json();
      setSfResults(data.results ?? []);
    } catch {
      toast.error("Sketchfab search failed");
    }
    setSfLoading(false);
  }, [sfQuery]);

  const downloadSketchfab = useCallback(async (uid: string, name: string) => {
    setSfDownloading(uid);
    try {
      const res = await fetch("/api/sketchfab/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, projectId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = data?.error ?? `HTTP ${res.status}`;
        console.error("[Import Sketchfab] Download API error:", reason, data);
        setSfDownloading(null);
        toast.error(`Import failed: ${reason}`);
        return;
      }
      if (!data.url) {
        const reason = data?.error ?? "No URL in response";
        console.error("[Import Sketchfab] No url in response:", data);
        setSfDownloading(null);
        toast.error(`Import failed: ${reason}`);
        return;
      }
      const ext = data.url.endsWith(".glb") ? "glb" : "gltf";
      const filename = `${uid}.${ext}`;
      const label = name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_") || uid;
      let code: string;
      try {
        code = generateUE5ImportCode(data.url, filename, label);
      } catch (e) {
        console.error("[Import Sketchfab] generateUE5ImportCode failed:", e);
        setSfDownloading(null);
        toast.error("Import failed: could not generate import code");
        return;
      }
      const execRes = await fetch("/api/ue5/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, code }),
      });
      const execData = await execRes.json().catch(() => ({}));
      if (!execRes.ok || !execData.commandId) {
        const reason = execData?.error ?? `HTTP ${execRes.status}`;
        console.error("[Import Sketchfab] UE5 execute error:", reason, execData);
        setSfDownloading(null);
        toast.error(`Import failed: ${reason}`);
        return;
      }
      toast.success(`${name} imported to UE5!`);
      setSfImportedId(uid);
      setTimeout(() => setSfImportedId(null), 3000);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[Import Sketchfab] Error:", e);
      setSfDownloading(null);
      toast.error(`Import failed: ${message}`);
    } finally {
      setSfDownloading(null);
    }
  }, [projectId]);

  const tabs: { id: TabId; label: string; icon: typeof Box }[] = [
    { id: "starter", label: "Starter", icon: Box },
    { id: "polyhaven", label: "Poly Haven", icon: Globe },
    { id: "sketchfab", label: "Sketchfab", icon: Download },
    { id: "templates", label: "Templates", icon: Shapes },
    { id: "scene", label: "Scene", icon: Terminal },
    { id: "history", label: "History", icon: Clock },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0A0A0B] border-r border-white/5">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-white/5 px-1 shrink-0 overflow-x-auto scrollbar-thin">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-3 text-[11px] uppercase tracking-wider font-medium transition border-b-2 whitespace-nowrap ${
              tab === t.id
                ? "text-white border-[#2196F3]"
                : "text-[#606068] border-transparent hover:text-[#A0A0A8]"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* ====== STARTER CONTENT ====== */}
        {tab === "starter" && (
          <div className="p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606068]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search starter content..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#1A1A1F] border border-white/5 rounded-lg text-sm text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/40 transition"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-thin mb-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    category === c.id
                      ? "bg-[#2196F3] text-white"
                      : "bg-[#1A1A1F] text-[#A0A0A8] border border-white/5 hover:border-[#2196F3]/30"
                  }`}
                >
                  <c.icon className="w-3 h-3" />
                  {c.id}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAssets.map((asset) => {
                const Icon = ASSET_ICON_MAP[asset.category] || Box;
                return (
                  <button
                    key={asset.path}
                    onClick={() => onAssetClick(asset)}
                    className="group bg-[#111114] rounded-xl border border-white/5 overflow-hidden hover:border-[#2196F3]/30 transition text-left epic-card"
                  >
                    <div className="h-16 flex items-center justify-center bg-[#0A0A0B]">
                      <Icon className="w-7 h-7 text-[#2196F3]/30 group-hover:text-[#2196F3]/60 transition" />
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-white truncate">{asset.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-[#606068] truncate">{asset.category}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Built-in</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-[#606068]">{filteredAssets.length} assets</p>
              <button
                onClick={() => onAssetClick({ name: "custom", path: "", category: "", subcategory: "", description: "" })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2196F3]/10 text-[#2196F3] text-xs font-medium hover:bg-[#2196F3]/20 transition"
              >
                <Sparkles className="w-3 h-3" />
                Ask AI to Place
              </button>
            </div>
          </div>
        )}

        {/* ====== POLY HAVEN ====== */}
        {tab === "polyhaven" && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              {(["models", "textures", "hdris"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => { setPhSubTab(st); setPhResults([]); }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    phSubTab === st
                      ? "bg-[#2196F3] text-white"
                      : "bg-[#1A1A1F] text-[#A0A0A8] border border-white/5"
                  }`}
                >
                  {st === "models" && <Box className="w-3 h-3" />}
                  {st === "textures" && <Paintbrush className="w-3 h-3" />}
                  {st === "hdris" && <Sun className="w-3 h-3" />}
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); searchPolyHaven(); }}
              className="relative mb-4"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606068]" />
              <input
                value={phQuery}
                onChange={(e) => setPhQuery(e.target.value)}
                placeholder={`Search Poly Haven ${phSubTab}... (rock, wood, sunset)`}
                className="w-full pl-10 pr-20 py-2.5 bg-[#1A1A1F] border border-white/5 rounded-lg text-sm text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/40 transition"
              />
              <button
                type="submit"
                disabled={phLoading || !phQuery.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded bg-[#2196F3] text-white text-xs font-medium disabled:opacity-40"
              >
                {phLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Search"}
              </button>
            </form>

            {phResults.length === 0 && !phLoading && (
              <div className="text-center py-12">
                <Globe className="w-10 h-10 text-[#2A2A30] mx-auto mb-3" />
                <p className="text-sm text-[#606068] mb-1">Search Poly Haven</p>
                <p className="text-xs text-[#606068]">Free CC0 {phSubTab} — no API key needed</p>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {phResults.map((r) => (
                <div
                  key={r.id}
                  className="group bg-[#111114] rounded-xl border border-white/5 overflow-hidden hover:border-[#2196F3]/30 transition"
                >
                  <div className="h-24 bg-[#0A0A0B] overflow-hidden relative">
                    <img
                      src={r.thumbnailUrl}
                      alt={r.name}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                      loading="lazy"
                    />
                    <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                      CC0 Free
                    </span>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium text-white truncate mb-1">
                      {r.name || r.id.replace(/_/g, " ")}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-[#606068]">
                        {r.downloadCount.toLocaleString()} downloads
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (phSubTab === "models") downloadPolyHaven(r.id, phSubTab, r.name || r.id.replace(/_/g, " "));
                        }}
                        disabled={phDownloading === r.id || phSubTab !== "models"}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2196F3] text-white text-[10px] font-semibold hover:bg-[#2196F3]/90 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        {phDownloading === r.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Importing…
                          </>
                        ) : phImportedId === r.id ? (
                          <>
                            <Check className="w-3 h-3" />
                            Imported!
                          </>
                        ) : (
                          <>
                            <Download className="w-3 h-3" />
                            Import to Scene
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====== SKETCHFAB ====== */}
        {tab === "sketchfab" && (
          <div className="p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); searchSketchfab(); }}
              className="relative mb-4"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606068]" />
              <input
                value={sfQuery}
                onChange={(e) => setSfQuery(e.target.value)}
                placeholder="Search Sketchfab... (dragon, castle, vehicle)"
                className="w-full pl-10 pr-20 py-2.5 bg-[#1A1A1F] border border-white/5 rounded-lg text-sm text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/40 transition"
              />
              <button
                type="submit"
                disabled={sfLoading || !sfQuery.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded bg-[#2196F3] text-white text-xs font-medium disabled:opacity-40"
              >
                {sfLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Search"}
              </button>
            </form>

            {sfResults.length === 0 && !sfLoading && (
              <div className="text-center py-12">
                <Download className="w-10 h-10 text-[#2A2A30] mx-auto mb-3" />
                <p className="text-sm text-[#606068] mb-1">Search Sketchfab</p>
                <p className="text-xs text-[#606068]">1M+ free 3D models (API key required for download)</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {sfResults.map((r) => (
                <div
                  key={r.uid}
                  className="group bg-[#111114] rounded-xl border border-white/5 overflow-hidden hover:border-[#2196F3]/30 transition"
                >
                  <div className="h-24 bg-[#0A0A0B] overflow-hidden relative">
                    {r.thumbnailUrl ? (
                      <img
                        src={r.thumbnailUrl}
                        alt={r.name}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Box className="w-8 h-8 text-[#2A2A30]" />
                      </div>
                    )}
                    <span className={`absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      r.license.includes("CC0") ? "bg-emerald-500/20 text-emerald-400" : "bg-[#2196F3]/20 text-[#2196F3]"
                    }`}>
                      {r.license.includes("CC0") ? "CC0" : "CC-BY"}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium text-white truncate mb-0.5">{r.name}</p>
                    <p className="text-[10px] text-[#606068] truncate mb-1">
                      by {r.author} · {(r.faceCount / 1000).toFixed(0)}K faces
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={`https://sketchfab.com/3d-models/${r.uid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#606068] hover:text-[#2196F3] transition"
                      >
                        <ExternalLink className="w-3 h-3 inline" />
                      </a>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          downloadSketchfab(r.uid, r.name);
                        }}
                        disabled={sfDownloading === r.uid}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2196F3] text-white text-[10px] font-semibold hover:bg-[#2196F3]/90 transition disabled:opacity-50 shrink-0"
                      >
                        {sfDownloading === r.uid ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Importing…
                          </>
                        ) : sfImportedId === r.uid ? (
                          <>
                            <Check className="w-3 h-3" />
                            Imported!
                          </>
                        ) : (
                          <>
                            <Download className="w-3 h-3" />
                            Import to Scene
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====== TEMPLATES ====== */}
        {tab === "templates" && (
          <div className="p-4 space-y-3">
            {TEMPLATES.map((t) => (
              <div
                key={t.key}
                className="bg-[#111114] rounded-xl border border-white/5 p-4 flex gap-4 hover:border-[#2196F3]/30 transition group"
              >
                <div className="w-20 h-[60px] rounded-lg bg-[#0A0A0B] flex items-center justify-center shrink-0">
                  <TreePine className="w-6 h-6 text-[#2196F3]/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-white truncate">{t.name}</h3>
                    <span className="text-[10px] text-[#606068] bg-[#1A1A1F] px-2 py-0.5 rounded">{t.time}</span>
                  </div>
                  <p className="text-xs text-[#A0A0A8] line-clamp-2 mb-2">{t.description}</p>
                  <button
                    onClick={() => onTemplateClick(t.name, t.description)}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#2196F3] text-white text-xs font-medium hover:bg-[#2196F3]/90 transition"
                  >
                    Use Template <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ====== SCENE ====== */}
        {tab === "scene" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">
                Scene Commands ({ue5Commands.length})
              </h3>
              {ue5Commands.length > 0 && (
                <button
                  onClick={() => {
                    if (confirmClear) { onClearScene(); setConfirmClear(false); }
                    else { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); }
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition ${
                    confirmClear
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "bg-[#1A1A1F] text-[#A0A0A8] border border-white/5 hover:border-red-500/30 hover:text-red-400"
                  }`}
                >
                  <Trash2 className="w-3 h-3" />
                  {confirmClear ? "Confirm Clear?" : "Clear Scene"}
                </button>
              )}
            </div>
            {ue5Commands.length === 0 ? (
              <div className="text-center py-12">
                <Terminal className="w-8 h-8 text-[#2A2A30] mx-auto mb-3" />
                <p className="text-sm text-[#606068]">No commands executed yet</p>
                <p className="text-xs text-[#606068] mt-1">Use the AI Co-Pilot to build your first scene</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...ue5Commands].reverse().map((cmd) => (
                  <div key={cmd.id} className="bg-[#111114] rounded-lg border border-white/5 overflow-hidden">
                    <button
                      onClick={() => setExpandedCmd(expandedCmd === cmd.id ? null : cmd.id)}
                      className="w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-white/[0.02] transition"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        cmd.status === "success" ? "bg-emerald-500"
                        : cmd.status === "error" ? "bg-red-500"
                        : cmd.status === "executing" ? "bg-amber-500 animate-pulse"
                        : "bg-[#606068]"
                      }`} />
                      <span className="text-xs text-white truncate flex-1">
                        {cmd.submitted_by_name || "Build"} — {cmd.status}
                      </span>
                      <span className="text-[10px] text-[#606068] shrink-0">
                        {new Date(cmd.created_at).toLocaleTimeString()}
                      </span>
                    </button>
                    {expandedCmd === cmd.id && cmd.code && (
                      <div className="border-t border-white/5 bg-[#0A0A0B]">
                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
                          <span className="text-[10px] text-[#606068] uppercase">Python</span>
                          <button onClick={() => handleCopy(cmd.code, cmd.id)} className="text-[#606068] hover:text-white transition p-1">
                            {copiedCode === cmd.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <pre className="p-3 text-xs text-[#E0E0E0] overflow-x-auto font-mono leading-relaxed max-h-48 overflow-y-auto">
                          {cmd.code.length > 500 ? cmd.code.slice(0, 500) + "\n..." : cmd.code}
                        </pre>
                        {cmd.error_log && (
                          <div className="px-3 py-2 border-t border-white/5 bg-red-500/5">
                            <p className="text-xs text-red-400 font-mono">{cmd.error_log.slice(0, 200)}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====== HISTORY ====== */}
        {tab === "history" && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-3.5 h-3.5 text-[#606068]" />
              {["All", "AI", "UE5", "Error"].map((f) => {
                const val = f === "All" ? null : f.toLowerCase();
                return (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(val)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                      historyFilter === val
                        ? "bg-[#2196F3] text-white"
                        : "bg-[#1A1A1F] text-[#A0A0A8] hover:text-white"
                    }`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
            {filteredHistory.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-8 h-8 text-[#2A2A30] mx-auto mb-3" />
                <p className="text-sm text-[#606068]">No activity yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredHistory.slice(0, 100).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 py-2 px-2 rounded hover:bg-white/[0.02] transition">
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${eventColor(entry.event_type)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#E0E0E0] truncate">{entry.detail}</p>
                      <p className="text-[10px] text-[#606068]">{new Date(entry.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
