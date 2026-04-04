"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  ScanSearch,
} from "lucide-react";
import type { AssetEntry } from "@/lib/ue5/assetLibrary";
import { generateUE5ImportCode, generateSketchfabImportCode } from "@/lib/ue5/importCode";
import { SCENE_TEMPLATES } from "@/lib/ue5/sceneTemplates";
import type { UE5Command, GodEyeEntry } from "@/lib/types";
import { toast } from "sonner";

const AI_ART_STYLES = [
  { value: "realistic", label: "Realistic" },
  { value: "cartoon", label: "Cartoon" },
  { value: "low_poly", label: "Low Poly" },
  { value: "sculpture", label: "Sculpture" },
  { value: "pbr", label: "PBR" },
] as const;

interface WorkspacePanelProps {
  ue5Commands: UE5Command[];
  godEyeLog: GodEyeEntry[];
  onAssetClick: (asset: AssetEntry) => void;
  onTemplateClick: (name: string, description: string) => void;
  onClearScene: () => void;
  projectId: string;
  onLimitReached?: (message: string) => void;
  userPlan?: "free" | "pro" | "team";
  onScanAssets?: () => Promise<void> | void;
  scanningAssets?: boolean;
}

const POLYHAVEN_POPULAR_IDS = [
  "ArmChair_01",
  "Barrel_01",
  "ceramic_vase_03",
  "Chandelier_01",
  "coast_rocks_05",
  "food_apple_01",
  "indoor_plant_04",
  "shoe_01",
  "wooden_table_02",
  "wooden_crate_01",
];

const TEMPLATES = Object.entries(SCENE_TEMPLATES).map(([key, t]) => ({
  key,
  name: t.name,
  description: t.description,
  time: "~30s",
}));

type TabId = "polyhaven" | "sketchfab" | "templates" | "scene" | "history" | "aigenerator";

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

export type ImportStatusDisplay = "textured" | "materials_only" | "mesh_only" | "failed";

interface ImportResultRow {
  id: string;
  source_provider: string;
  source_url: string | null;
  file_type: string | null;
  ue_asset_path: string | null;
  material_count: number;
  texture_count: number;
  import_status: ImportStatusDisplay;
  import_error: string | null;
  created_at: string;
}

export function WorkspacePanel({
  ue5Commands,
  godEyeLog,
  onAssetClick,
  onTemplateClick,
  onClearScene,
  projectId,
  onLimitReached,
  userPlan,
  onScanAssets,
  scanningAssets = false,
}: WorkspacePanelProps) {
  const [tab, setTab] = useState<TabId>("polyhaven");
  const [historyFilter, setHistoryFilter] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiArtStyle, setAiArtStyle] = useState<string>("realistic");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiTaskId, setAiTaskId] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiModelUrl, setAiModelUrl] = useState<string | null>(null);
  const [aiImporting, setAiImporting] = useState(false);
  const [expandedCmd, setExpandedCmd] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [scannedAssets, setScannedAssets] = useState<Array<{ path?: string; name?: string; type?: string }>>([]);
  const [scanSearch, setScanSearch] = useState("");

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

  // Recent imports (from ue5_import_assets) for badges + UE path
  const [importResults, setImportResults] = useState<ImportResultRow[]>([]);
  const fetchImportResults = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/ue5/import-results?projectId=${encodeURIComponent(projectId)}`);
      const data = await res.json().catch(() => ({}));
      setImportResults(data.imports ?? []);
    } catch {
      setImportResults([]);
    }
  }, [projectId]);
  useEffect(() => {
    fetchImportResults();
  }, [fetchImportResults]);
  // Refetch after a successful import (when user clicks import we don't have commandId here; poll briefly)
  useEffect(() => {
    if (!phImportedId && !sfImportedId) return;
    const t = setTimeout(fetchImportResults, 3000);
    return () => clearTimeout(t);
  }, [phImportedId, sfImportedId, fetchImportResults]);

  const fetchScannedAssets = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/ue5/scan-results?projectId=${encodeURIComponent(projectId)}`);
      const data = await res.json().catch(() => ({}));
      setScannedAssets(Array.isArray(data.assets) ? data.assets : []);
    } catch {
      setScannedAssets([]);
    }
  }, [projectId]);

  useEffect(() => {
    if (tab !== "scene") return;
    fetchScannedAssets();
  }, [tab, fetchScannedAssets]);

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
      toast.error("3D model search failed");
    }
    setPhLoading(false);
  }, [phQuery, phSubTab]);

  const downloadPolyHaven = useCallback(async (assetId: string, type: string, displayName: string) => {
    console.log(
      `IMPORT CLICKED: model=${displayName}, id=${assetId}, generating code… projectId=${projectId ?? "(missing)"}`
    );
    setPhDownloading(assetId);
    toast.info("Downloading 3D model (this may take a moment for large files)…");
    const requestType = type === "hdris" ? "hdri" : type === "textures" ? "texture" : "model";
    try {
      const res = await fetch("/api/polyhaven/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assetId, type: requestType, projectId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = data?.error ?? `HTTP ${res.status}`;
        console.error("[Import Poly Haven] Download API error:", reason, data);
        setPhDownloading(null);
        if (data?.limitReached) onLimitReached?.(reason);
        else toast.error(`Import failed: ${reason}`);
        return;
      }
      if (!data.url) {
        const reason = data?.error ?? "No URL in response";
        console.error("[Import Poly Haven] No url in response:", data);
        setPhDownloading(null);
        toast.error(`Import failed: ${reason}`);
        return;
      }
      const ext = "fbx";
      const filename = `${assetId.replace(/[^a-zA-Z0-9_-]/g, "_")}.${ext}`;
      const label = (displayName || assetId).replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
      let code: string;
      try {
        code = generateUE5ImportCode(data.url, filename, label, {
          traceAssetId: assetId,
          destinationName: assetId.replace(/[^a-zA-Z0-9_]/g, "_") || label,
        });
      } catch (e) {
        console.error("[Import Poly Haven] generateUE5ImportCode failed:", e);
        setPhDownloading(null);
        toast.error("Import failed: could not generate import code");
        return;
      }
      const execRes = await fetch("/api/ue5/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          code,
          commandType: "import",
          importContext: {
            source_provider: "polyhaven",
            source_url: data.url,
            file_type: ext,
          },
        }),
      });
      const execData = await execRes.json().catch(() => ({}));
      if (execData.commandId) {
        console.log(`COMMAND QUEUED: id=${execData.commandId}`);
      }
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
  }, [projectId, onLimitReached]);

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
      toast.error("Community model search failed");
    }
    setSfLoading(false);
  }, [sfQuery]);

  const downloadSketchfab = useCallback(async (uid: string, name: string) => {
    console.log(
      `IMPORT CLICKED: model=${name}, id=${uid}, generating code… projectId=${projectId ?? "(missing)"}`
    );
    setSfDownloading(uid);
    toast.info("Downloading 3D model (this may take a moment for large files)…");
    try {
      const res = await fetch("/api/sketchfab/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ uid, projectId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = data?.error ?? `HTTP ${res.status}`;
        console.error("[Import Sketchfab] Download API error:", reason, data);
        setSfDownloading(null);
        if (data?.limitReached) onLimitReached?.(reason);
        else toast.error(`Import failed: ${reason}`);
        return;
      }
      if (!data.url) {
        const reason = data?.error ?? "No URL in response";
        console.error("[Import Sketchfab] No url in response:", data);
        setSfDownloading(null);
        toast.error(`Import failed: ${reason}`);
        return;
      }
      const label = name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_") || uid;
      let code: string;
      try {
        code = generateSketchfabImportCode(data.url, `${uid}.zip`, label, {
          traceAssetId: uid,
          destinationName: `sf_${uid}`,
        });
      } catch (e) {
        console.error("[Import Sketchfab] generateSketchfabImportCode failed:", e);
        setSfDownloading(null);
        toast.error("Import failed: could not generate import code");
        return;
      }
      const execRes = await fetch("/api/ue5/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          code,
          commandType: "import",
          importContext: {
            source_provider: "sketchfab",
            source_url: data.url,
            file_type: "zip",
          },
        }),
      });
      const execData = await execRes.json().catch(() => ({}));
      if (execData.commandId) {
        console.log(`COMMAND QUEUED: id=${execData.commandId}`);
      }
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
  }, [projectId, onLimitReached]);

  const handleAiGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiTaskId(null);
    setAiStatus(null);
    setAiModelUrl(null);
    try {
      const res = await fetch("/api/meshy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt: aiPrompt.trim(), artStyle: aiArtStyle, type: "text" }),
      });
      const data = await res.json();
      if (res.status === 403 && data.limitReached) {
        onLimitReached?.(data.error ?? "Team plan required");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to start generation");
      setAiTaskId(data.taskId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start generation");
      setAiGenerating(false);
    }
  }, [aiPrompt, aiArtStyle, onLimitReached]);

  useEffect(() => {
    if (!aiTaskId || !aiGenerating) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/meshy/status?taskId=${encodeURIComponent(aiTaskId)}`, { credentials: "include" });
        const data = await res.json();
        setAiStatus(data.status);
        if (data.status === "SUCCEEDED" && data.modelUrl) {
          setAiModelUrl(data.modelUrl);
          setAiGenerating(false);
          return;
        }
        if (data.status === "FAILED") {
          setAiGenerating(false);
          toast.error("Generation failed");
          return;
        }
      } catch { /* ignore */ }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [aiTaskId, aiGenerating]);

  const handleAiImport = useCallback(async () => {
    if (!aiTaskId || !projectId) return;
    setAiImporting(true);
    try {
      const res = await fetch("/api/meshy/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ taskId: aiTaskId, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      toast.success("Importing to UE5…");
      setAiTaskId(null);
      setAiStatus(null);
      setAiModelUrl(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setAiImporting(false);
    }
  }, [aiTaskId, projectId]);

  const tabs: { id: TabId; label: string; icon: typeof Box }[] = [
    { id: "polyhaven", label: "3D Models", icon: Globe },
    { id: "sketchfab", label: "Community", icon: Download },
    { id: "aigenerator", label: "AI Generator", icon: Sparkles },
    { id: "templates", label: "Templates", icon: Shapes },
    { id: "scene", label: "Scene", icon: Terminal },
    { id: "history", label: "History", icon: Clock },
  ];

  const scannedGrouped = useMemo(() => {
    const q = scanSearch.trim().toLowerCase();
    const filtered = scannedAssets.filter((a) => {
      if (!q) return true;
      return (
        (a.name ?? "").toLowerCase().includes(q) ||
        (a.path ?? "").toLowerCase().includes(q) ||
        (a.type ?? "").toLowerCase().includes(q)
      );
    });
    const groups = new Map<string, Array<{ path?: string; name?: string; type?: string }>>();
    for (const a of filtered) {
      const key = a.type || "Unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [scannedAssets, scanSearch]);

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
        {/* Recent imports: badges + UE path (visible on asset tabs) */}
        {(tab === "polyhaven" || tab === "sketchfab") && importResults.length > 0 && (
          <div className="px-4 pt-3 pb-2 border-b border-white/5">
            <p className="text-[10px] font-medium text-[#606068] uppercase tracking-wider mb-2">Recent imports</p>
            <ul className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-thin">
              {importResults.slice(0, 10).map((row) => (
                <li key={row.id} className="flex items-center gap-2 flex-wrap text-xs">
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded font-medium ${
                      row.import_status === "textured"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : row.import_status === "materials_only" || row.import_status === "mesh_only"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-red-500/20 text-red-400"
                    }`}
                    title={`Materials: ${row.material_count}, Textures: ${row.texture_count}`}
                  >
                    {row.import_status === "textured"
                      ? "Textured ✅"
                      : row.import_status === "materials_only"
                        ? "Materials only ⚠️"
                        : row.import_status === "mesh_only"
                          ? "Mesh only ⚠️"
                          : "Failed ❌"}
                  </span>
                  <span className="text-[#606068] shrink-0">{row.source_provider}</span>
                  {row.ue_asset_path && (
                    <code
                      className="flex-1 min-w-0 truncate text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-[#A0A0A8]"
                      title={row.ue_asset_path}
                    >
                      {row.ue_asset_path}
                    </code>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ====== 3D MODELS ====== */}
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
            {phSubTab === "models" && (
              <div className="mb-4">
                <p className="text-xs font-medium text-[#A0A0A8] mb-2">Popular</p>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {POLYHAVEN_POPULAR_IDS.map((id) => {
                    const name = id.replace(/_/g, " ");
                    const thumb = `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256`;
                    return (
                      <div
                        key={id}
                        className="group shrink-0 w-28 rounded-xl border border-white/5 overflow-hidden bg-[#111114] hover:border-[#2196F3]/30 transition"
                      >
                        <div className="h-20 bg-[#0A0A0B] overflow-hidden relative">
                          <img
                            src={thumb}
                            alt={name}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-1.5">
                          <p className="text-[10px] font-medium text-white truncate mb-1">{name}</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              downloadPolyHaven(id, "models", name);
                            }}
                            disabled={phDownloading === id}
                            className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-[#2196F3] text-white text-[10px] font-semibold hover:bg-[#2196F3]/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {phDownloading === id ? (
                              <>
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                Downloading…
                              </>
                            ) : phImportedId === id ? (
                              <>
                                <Check className="w-2.5 h-2.5" />
                                Imported!
                              </>
                            ) : (
                              <>
                                <Download className="w-2.5 h-2.5" />
                                Import
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); searchPolyHaven(); }}
              className="relative mb-4"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606068]" />
              <input
                value={phQuery}
                onChange={(e) => setPhQuery(e.target.value)}
                placeholder={`Search 3D models... (rock, wood, sunset)`}
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
                <p className="text-sm text-[#606068] mb-1">Search 3D models</p>
                <p className="text-xs text-[#606068]">Models, textures, and HDRI</p>
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
                            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                            <span className="truncate">Downloading model…</span>
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

        {/* ====== COMMUNITY ====== */}
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
                placeholder="Search community models... (dragon, castle, vehicle)"
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
                <p className="text-sm text-[#606068] mb-1">Search community models</p>
                <p className="text-xs text-[#606068]">1M+ professional 3D models</p>
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
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium text-white truncate mb-0.5">{r.name}</p>
                    <p className="text-[10px] text-[#606068] truncate mb-1">
                      {(r.faceCount / 1000).toFixed(0)}K faces
                    </p>
                    <div className="flex items-center justify-between gap-2">
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
                            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                            <span className="truncate">Downloading model…</span>
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

        {/* ====== AI GENERATOR (Pro & Team only) ====== */}
        {tab === "aigenerator" && (
          <div className="p-4 relative">
            {userPlan === "free" ? (
              <div className="rounded-xl border border-white/10 bg-[#111114]/80 p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#2196F3]/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-[#2196F3]" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">AI 3D Generator — Pro &amp; Team Only</h3>
                <p className="text-xs text-[#A0A0A8] mb-4">
                  Create custom 3D models from text or images. Upgrade to Pro ($19/mo) for 3 models per day or Team ($49/mo) for 10 models per day.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <a
                    href="/#pricing"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white text-xs font-semibold hover:brightness-110 transition"
                  >
                    Upgrade to Pro
                  </a>
                  <a
                    href="/#pricing"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-white/20 text-white text-xs font-semibold hover:bg-white/10 transition"
                  >
                    Upgrade to Team
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <a
                  href="/generate"
                  className="inline-flex items-center gap-1.5 text-xs text-[#2196F3] hover:underline mb-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open full AI 3D Generator
                </a>
                <p className="text-xs text-[#A0A0A8]">Describe what you want to create. Generation takes 1–3 minutes.</p>
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe what to create… (e.g. a medieval sword, a treasure chest, a dragon)"
                  className="w-full px-4 py-3 rounded-xl bg-[#111114] border border-white/10 text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/40 transition text-sm"
                />
                <div>
                  <label className="block text-[10px] font-medium text-[#606068] uppercase tracking-wider mb-1.5">Art style</label>
                  <select
                    value={aiArtStyle}
                    onChange={(e) => setAiArtStyle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#111114] border border-white/10 text-white outline-none focus:border-[#2196F3]/40 transition text-sm"
                  >
                    {AI_ART_STYLES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || !aiPrompt.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating your 3D model…
                    </>
                  ) : (
                    <>Generate 3D Model</>
                  )}
                </button>
                {aiGenerating && aiStatus && (
                  <div className="rounded-lg bg-[#1A1A1F] px-3 py-2 text-xs text-[#A0A0A8]">
                    Status: {aiStatus}
                  </div>
                )}
                {aiModelUrl && !aiGenerating && (
                  <div className="rounded-xl border border-[#2196F3]/20 bg-[#111114] p-4">
                    <p className="text-xs text-emerald-400 mb-2">Model ready!</p>
                    <button
                      type="button"
                      onClick={handleAiImport}
                      disabled={aiImporting}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#2196F3] text-white text-sm font-semibold hover:bg-[#2196F3]/90 transition disabled:opacity-50"
                    >
                      {aiImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Import to UE5
                    </button>
                  </div>
                )}
              </div>
            )}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    await onScanAssets?.();
                    await fetchScannedAssets();
                  }}
                  disabled={scanningAssets}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-[#1A1A1F] text-[#A0A0A8] border border-white/5 hover:border-[#2196F3]/40 hover:text-white transition disabled:opacity-50"
                >
                  {scanningAssets ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanSearch className="w-3 h-3" />}
                  {scanningAssets ? "Scanning..." : "Scan Assets"}
                </button>
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
            </div>

            <div className="mb-4 rounded-xl border border-white/5 bg-[#111114] p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs text-[#A0A0A8]">
                  Scanned Assets ({scannedAssets.length})
                </p>
              </div>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#606068]" />
                <input
                  value={scanSearch}
                  onChange={(e) => setScanSearch(e.target.value)}
                  placeholder="Search scanned assets..."
                  className="w-full pl-8 pr-2 py-1.5 bg-[#0A0A0B] border border-white/5 rounded text-xs text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/40"
                />
              </div>
              <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-2">
                {scannedGrouped.length === 0 ? (
                  <p className="text-[11px] text-[#606068]">No scanned assets yet. Click Scan Assets.</p>
                ) : (
                  scannedGrouped.map(([type, items]) => (
                    <div key={type}>
                      <p className="text-[10px] text-[#606068] uppercase tracking-wider mb-1">
                        {type} ({items.length})
                      </p>
                      <div className="space-y-1">
                        {items.slice(0, 30).map((a, i) => (
                          <button
                            key={`${a.path ?? a.name ?? type}-${i}`}
                            onClick={() =>
                              onAssetClick({
                                name: a.name ?? a.path ?? "Asset",
                                category: "Scanned",
                                subcategory: type,
                                description: `Scanned ${type} asset`,
                                path: a.path ?? "",
                              } as AssetEntry)
                            }
                            className="w-full text-left px-2 py-1 rounded bg-[#0A0A0B] border border-white/5 hover:border-[#2196F3]/30 text-[11px] text-[#A0A0A8] hover:text-white transition"
                            title={a.path}
                          >
                            {(a.name ?? "Unnamed")} <span className="text-[#606068]">· {a.path}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
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
