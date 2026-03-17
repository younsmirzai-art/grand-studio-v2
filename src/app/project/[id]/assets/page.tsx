"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Search,
  Copy,
  Check,
  ArrowLeft,
  Box,
  Layers,
  Paintbrush,
  Shapes,
  Sparkles,
  Globe,
  Loader2,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ASSET_CATALOG,
  getAssetCategories,
  getAssetsByCategory,
  type AssetEntry,
} from "@/lib/ue5/assetLibrary";
import { useProjectStore } from "@/lib/stores/projectStore";
import { getClient } from "@/lib/supabase/client";

const CATEGORY_META: Record<
  string,
  { icon: React.ReactNode; color: string; badgeBg: string }
> = {
  Architecture: {
    icon: <Box className="w-3.5 h-3.5" />,
    color: "text-blue-400",
    badgeBg: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  },
  Props: {
    icon: <Layers className="w-3.5 h-3.5" />,
    color: "text-emerald-400",
    badgeBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  },
  Materials: {
    icon: <Paintbrush className="w-3.5 h-3.5" />,
    color: "text-purple-400",
    badgeBg: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  },
  BasicShapes: {
    icon: <Shapes className="w-3.5 h-3.5" />,
    color: "text-amber-400",
    badgeBg: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  },
  Particles: {
    icon: <Sparkles className="w-3.5 h-3.5" />,
    color: "text-rose-400",
    badgeBg: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  },
};

interface SketchfabResult {
  id: string;
  name: string;
  author: string;
  thumbnail: string | null;
  viewCount: number;
  url: string;
}

function AssetCard({
  asset,
  copiedPath,
  onCopy,
}: {
  asset: AssetEntry;
  copiedPath: string | null;
  onCopy: (path: string) => void;
}) {
  const meta = CATEGORY_META[asset.category];
  const isCopied = copiedPath === asset.path;

  return (
    <button
      onClick={() => onCopy(asset.path)}
      className="group text-left rounded-xl border border-boss-border bg-boss-card hover:border-gold/30 hover:bg-boss-surface transition-all duration-200 p-4 flex flex-col gap-2.5 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between gap-2 relative">
        <h3 className="text-sm font-medium text-text-primary group-hover:text-gold transition-colors leading-tight">
          {asset.name}
        </h3>
        <span
          className={`shrink-0 transition-colors ${isCopied ? "text-emerald-400" : "text-text-muted group-hover:text-text-secondary"}`}
        >
          {isCopied ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </span>
      </div>

      <Badge
        className={`text-[10px] px-1.5 py-0 h-5 border ${meta?.badgeBg ?? "bg-boss-elevated text-text-muted border-boss-border"}`}
      >
        {meta?.icon}
        {asset.category}
      </Badge>

      <p className="text-xs text-text-secondary leading-relaxed">
        {asset.description}
      </p>

      <p
        className="text-[10px] text-text-muted font-mono truncate mt-auto pt-1 border-t border-boss-border/50"
        title={asset.path}
      >
        {asset.path}
      </p>
    </button>
  );
}

function SketchfabTab({ projectId }: { projectId: string }) {
  const addChatTurn = useProjectStore((s) => s.addChatTurn);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SketchfabResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(
        `/api/tools/sketchfab?q=${encodeURIComponent(query.trim())}`
      );
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const suggestToTeam = async (model: SketchfabResult) => {
    const message = `[SKETCHFAB] Found 3D model: **${model.name}** by ${model.author}\n${model.url}\n\nConsider importing this into UE5 for the project.`;
    const supabase = getClient();
    const { data, error } = await supabase
      .from("chat_turns")
      .insert({
        project_id: projectId,
        agent_name: "System",
        agent_title: "Tool",
        content: message,
        turn_type: "discussion",
      })
      .select()
      .single();
    if (error) {
      toast.error("Failed to post");
      return;
    }
    if (data) addChatTurn(data);
    toast.success("Suggested to team");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search free 3D models (e.g. car, tree, character)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="bg-boss-card border-boss-border text-text-primary placeholder:text-text-muted"
        />
        <Button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="bg-agent-teal hover:bg-agent-teal/90 text-white shrink-0 gap-1.5"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          Search
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {results.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-boss-border bg-boss-card overflow-hidden group hover:border-agent-teal/30 transition-colors"
            >
              {r.thumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={r.thumbnail}
                  alt={r.name}
                  className="w-full h-28 object-cover"
                />
              ) : (
                <div className="w-full h-28 bg-boss-elevated flex items-center justify-center text-text-muted">
                  <Box className="w-8 h-8" />
                </div>
              )}
              <div className="p-3 space-y-1.5">
                <p
                  className="text-xs font-medium text-text-primary truncate"
                  title={r.name}
                >
                  {r.name}
                </p>
                <p className="text-[10px] text-text-muted truncate">
                  by {r.author}
                </p>
                <p className="text-[10px] text-text-muted">
                  {r.viewCount.toLocaleString()} views
                </p>
                <div className="flex gap-1.5 pt-1">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-agent-teal hover:underline font-medium"
                  >
                    View model
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1.5 text-[10px] text-gold hover:bg-gold/10"
                    onClick={() => suggestToTeam(r)}
                  >
                    <MessageSquare className="w-3 h-3 mr-0.5" />
                    Suggest
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-text-muted">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium mb-1">
            {searched
              ? "No models found"
              : "Search community models"}
          </p>
          <p className="text-xs">
            {searched
              ? "Try different keywords"
              : "Find free 3D assets to import into your UE5 project"}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AssetsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const project = useProjectStore((s) => s.project);

  const [searchQuery, setSearchQuery] = useState("");
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const categories = useMemo(() => getAssetCategories(), []);

  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return ASSET_CATALOG.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.path.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.subcategory.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleCopy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      toast.success("Asset path copied to clipboard", {
        description: path,
        duration: 2000,
      });
      setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const totalAssets = ASSET_CATALOG.length;

  return (
    <>
      <Header
        projectName={project?.name ?? "Loading..."}
        executingCommand={null}
      />

      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-[1400px] mx-auto space-y-6">
          {/* Page header */}
          <div className="space-y-4">
            <Link
              href={`/project/${projectId}`}
              className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-sm transition-colors w-fit"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to project
            </Link>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  Asset Browser
                </h2>
                <p className="text-sm text-text-muted mt-1">
                  {totalAssets} UE5 assets available — click any asset to copy
                  its path
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <Input
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-boss-card border-boss-border text-text-primary placeholder:text-text-muted"
                />
              </div>
            </div>
          </div>

          {/* Search results */}
          {filteredAssets ? (
            <div className="space-y-3">
              <p className="text-xs text-text-muted">
                {filteredAssets.length} result
                {filteredAssets.length !== 1 ? "s" : ""} for &ldquo;
                {searchQuery}&rdquo;
              </p>
              {filteredAssets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredAssets.map((asset) => (
                    <AssetCard
                      key={asset.path}
                      asset={asset}
                      copiedPath={copiedPath}
                      onCopy={handleCopy}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-text-muted">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium">No assets found</p>
                  <p className="text-xs mt-1">
                    Try a different search term
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Category tabs */
            <Tabs defaultValue={categories[0]}>
              <TabsList
                variant="line"
                className="border-b border-boss-border w-full justify-start gap-0 overflow-x-auto"
              >
                {categories.map((cat) => {
                  const meta = CATEGORY_META[cat];
                  return (
                    <TabsTrigger
                      key={cat}
                      value={cat}
                      className="gap-1.5 text-text-muted data-[state=active]:text-text-primary shrink-0"
                    >
                      <span className={meta?.color}>{meta?.icon}</span>
                      {cat === "BasicShapes" ? "Shapes" : cat}
                      <span className="text-[10px] text-text-muted/60 ml-0.5">
                        {getAssetsByCategory(cat).length}
                      </span>
                    </TabsTrigger>
                  );
                })}
                <TabsTrigger
                  value="sketchfab"
                  className="gap-1.5 text-text-muted data-[state=active]:text-text-primary shrink-0"
                >
                  <span className="text-agent-teal">
                    <Globe className="w-3.5 h-3.5" />
                  </span>
                  Community
                </TabsTrigger>
              </TabsList>

              {categories.map((cat) => {
                const assets = getAssetsByCategory(cat);
                const subcategories = [
                  ...new Set(assets.map((a) => a.subcategory)),
                ];
                return (
                  <TabsContent key={cat} value={cat} className="pt-4">
                    <div className="space-y-6">
                      {subcategories.map((sub) => {
                        const subAssets = assets.filter(
                          (a) => a.subcategory === sub
                        );
                        return (
                          <div key={sub}>
                            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                              {sub}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                              {subAssets.map((asset) => (
                                <AssetCard
                                  key={asset.path}
                                  asset={asset}
                                  copiedPath={copiedPath}
                                  onCopy={handleCopy}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>
                );
              })}

              <TabsContent value="sketchfab" className="pt-4">
                <SketchfabTab projectId={projectId} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </>
  );
}
