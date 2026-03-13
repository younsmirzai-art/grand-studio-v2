"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Box,
  TreePine,
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
} from "lucide-react";
import { ASSET_CATALOG, type AssetEntry } from "@/lib/ue5/assetLibrary";
import { SCENE_TEMPLATES } from "@/lib/ue5/sceneTemplates";
import type { UE5Command, GodEyeEntry } from "@/lib/types";

interface WorkspacePanelProps {
  ue5Commands: UE5Command[];
  godEyeLog: GodEyeEntry[];
  onAssetClick: (asset: AssetEntry) => void;
  onTemplateClick: (name: string, description: string) => void;
  onClearScene: () => void;
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

type TabId = "assets" | "templates" | "scene" | "history";

export function WorkspacePanel({
  ue5Commands,
  godEyeLog,
  onAssetClick,
  onTemplateClick,
  onClearScene,
}: WorkspacePanelProps) {
  const [tab, setTab] = useState<TabId>("assets");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [historyFilter, setHistoryFilter] = useState<string | null>(null);
  const [expandedCmd, setExpandedCmd] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

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

  const tabs: { id: TabId; label: string }[] = [
    { id: "assets", label: "Assets" },
    { id: "templates", label: "Templates" },
    { id: "scene", label: "Scene" },
    { id: "history", label: "History" },
  ];

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

  return (
    <div className="flex flex-col h-full bg-[#0A0A0B] border-r border-white/5">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-white/5 px-2 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-xs uppercase tracking-wider font-medium transition border-b-2 ${
              tab === t.id
                ? "text-white border-[#2196F3]"
                : "text-[#606068] border-transparent hover:text-[#A0A0A8]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tab === "assets" && (
          <div className="p-4">
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606068]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assets... (walls, trees, lights)"
                className="w-full pl-10 pr-4 py-2.5 bg-[#1A1A1F] border border-white/5 rounded-lg text-sm text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/40 transition"
              />
            </div>

            {/* Category pills */}
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

            {/* Asset Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAssets.map((asset) => {
                const Icon = ASSET_ICON_MAP[asset.category] || Box;
                return (
                  <button
                    key={asset.path}
                    onClick={() => onAssetClick(asset)}
                    className="group bg-[#111114] rounded-xl border border-white/5 overflow-hidden hover:border-[#2196F3]/30 transition text-left epic-card"
                  >
                    <div className="h-20 flex items-center justify-center bg-[#0A0A0B]">
                      <Icon className="w-8 h-8 text-[#2196F3]/30 group-hover:text-[#2196F3]/60 transition" />
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-white truncate">
                        {asset.name}
                      </p>
                      <p className="text-xs text-[#606068] truncate">
                        {asset.category}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom actions */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-[#606068]">
                {filteredAssets.length} assets available
              </p>
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
                    <h3 className="text-sm font-semibold text-white truncate">
                      {t.name}
                    </h3>
                    <span className="text-[10px] text-[#606068] bg-[#1A1A1F] px-2 py-0.5 rounded">
                      {t.time}
                    </span>
                  </div>
                  <p className="text-xs text-[#A0A0A8] line-clamp-2 mb-2">
                    {t.description}
                  </p>
                  <button
                    onClick={() => onTemplateClick(t.name, t.description)}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#2196F3] text-white text-xs font-medium hover:bg-[#2196F3]/90 transition"
                  >
                    Use Template
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "scene" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">
                Scene Commands ({ue5Commands.length})
              </h3>
              {ue5Commands.length > 0 && (
                <button
                  onClick={() => {
                    if (confirmClear) {
                      onClearScene();
                      setConfirmClear(false);
                    } else {
                      setConfirmClear(true);
                      setTimeout(() => setConfirmClear(false), 3000);
                    }
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
                <p className="text-xs text-[#606068] mt-1">
                  Use the AI Co-Pilot to build your first scene
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...ue5Commands].reverse().map((cmd) => (
                  <div
                    key={cmd.id}
                    className="bg-[#111114] rounded-lg border border-white/5 overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedCmd(expandedCmd === cmd.id ? null : cmd.id)
                      }
                      className="w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-white/[0.02] transition"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          cmd.status === "success"
                            ? "bg-emerald-500"
                            : cmd.status === "error"
                            ? "bg-red-500"
                            : cmd.status === "executing"
                            ? "bg-amber-500 animate-pulse"
                            : "bg-[#606068]"
                        }`}
                      />
                      <span className="text-xs text-white truncate flex-1">
                        {cmd.submitted_by_name || "Build"} —{" "}
                        {cmd.status}
                      </span>
                      <span className="text-[10px] text-[#606068] shrink-0">
                        {new Date(cmd.created_at).toLocaleTimeString()}
                      </span>
                    </button>
                    {expandedCmd === cmd.id && cmd.code && (
                      <div className="border-t border-white/5 bg-[#0A0A0B]">
                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
                          <span className="text-[10px] text-[#606068] uppercase">
                            Python
                          </span>
                          <button
                            onClick={() => handleCopy(cmd.code, cmd.id)}
                            className="text-[#606068] hover:text-white transition p-1"
                          >
                            {copiedCode === cmd.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <pre className="p-3 text-xs text-[#E0E0E0] overflow-x-auto font-mono leading-relaxed max-h-48 overflow-y-auto">
                          {cmd.code.length > 500
                            ? cmd.code.slice(0, 500) + "\n..."
                            : cmd.code}
                        </pre>
                        {cmd.error_log && (
                          <div className="px-3 py-2 border-t border-white/5 bg-red-500/5">
                            <p className="text-xs text-red-400 font-mono">
                              {cmd.error_log.slice(0, 200)}
                            </p>
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
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 py-2 px-2 rounded hover:bg-white/[0.02] transition"
                  >
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${eventColor(
                        entry.event_type
                      )}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#E0E0E0] truncate">
                        {entry.detail}
                      </p>
                      <p className="text-[10px] text-[#606068]">
                        {new Date(entry.created_at).toLocaleTimeString()}
                      </p>
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
