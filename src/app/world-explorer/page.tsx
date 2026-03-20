"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Globe2,
  Loader2,
  ChevronLeft,
  ExternalLink,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { getClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";
import { toast } from "sonner";

const PRESETS = [
  "Paris",
  "London",
  "New York",
  "Tokyo",
  "Dubai",
  "Rome",
  "Mount Everest",
  "Grand Canyon",
  "San Francisco",
] as const;

const CESIUM_TOKEN_STORAGE_KEY = "cesium_ion_token";
type QualityMode = "performance" | "balanced" | "ultra";

export default function WorldExplorerPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number; displayName: string } | null>(null);
  const [loadingCoords, setLoadingCoords] = useState(false);
  const [importing, setImporting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [quality, setQuality] = useState<QualityMode>("balanced");

  const [tokenInput, setTokenInput] = useState("");
  const [hasSavedToken, setHasSavedToken] = useState(false);
  const [editingToken, setEditingToken] = useState(false);

  useEffect(() => {
    const auth = createAuthClient();
    auth.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/auth/login?redirectTo=/world-explorer");
        return;
      }
      setUser({ id: data.user.id });
    });
  }, [router]);

  useEffect(() => {
    try {
      const t = localStorage.getItem(CESIUM_TOKEN_STORAGE_KEY);
      if (t?.trim()) {
        setHasSavedToken(true);
        setTokenInput(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const supabase = getClient();
    supabase
      .from("projects")
      .select("id, name, created_at")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setProjects((data as Project[]) ?? []));
  }, [user]);

  const resolvedLabel = useMemo(() => coords?.displayName ?? selectedName ?? "", [coords, selectedName]);

  const showSetupOnly = !hasSavedToken || editingToken;

  const saveToken = useCallback(() => {
    const t = tokenInput.trim();
    if (!t) {
      toast.error("Paste your Cesium Ion access token");
      return;
    }
    try {
      localStorage.setItem(CESIUM_TOKEN_STORAGE_KEY, t);
      setHasSavedToken(true);
      setEditingToken(false);
      toast.success("Token saved");
    } catch {
      toast.error("Could not save token in this browser");
    }
  }, [tokenInput]);

  const lookup = useCallback(async (name: string) => {
    const q = name.trim();
    if (!q) return;
    setLoadingCoords(true);
    setSelectedName(q);
    setCoords(null);
    try {
      const res = await fetch(`/api/world/geocode?q=${encodeURIComponent(q)}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setCoords({ lat: Number(data.lat), lon: Number(data.lon), displayName: data.displayName ?? q });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Location lookup failed");
    } finally {
      setLoadingCoords(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!coords || !selectedName) return;
    if (!projectId) {
      toast.error("Select a project");
      return;
    }
    let cesiumIonToken = "";
    try {
      cesiumIonToken = localStorage.getItem(CESIUM_TOKEN_STORAGE_KEY)?.trim() ?? "";
    } catch {
      /* ignore */
    }
    setImporting(true);
    try {
      const res = await fetch("/api/world/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          locationName: selectedName,
          latitude: coords.lat,
          longitude: coords.lon,
          cesiumIonToken,
          quality,
        }),
      });
      const data = await res.json();
      if (res.status === 403 && data.limitReached) {
        toast.error(data.error ?? "Daily limit reached");
        setImporting(false);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      toast.success("Import queued. Open your project to run it in UE5.");
      router.push(`/project/${projectId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [coords, selectedName, projectId, quality, router]);

  if (user === null) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2196F3]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
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
            <Globe2 className="w-4 h-4 text-[#2196F3]" />
            Grand Studio World Explorer
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Beta
            </span>
          </span>
        </div>
      </header>

      <main className="relative max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white flex items-center justify-center gap-3 mb-2 flex-wrap">
            <Globe2 className="w-12 h-12 text-[#2196F3]" />
            World Explorer
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/35">
              Beta
            </span>
          </h1>
          <p className="text-lg text-[#A0A0A8]">
            Import real-world cities, mountains, and terrain into your UE5 scenes
          </p>
          <p className="text-sm text-[#808088] mt-3 max-w-2xl mx-auto">
            World Explorer is a Beta feature. To use it, you need a free Cesium Ion account.
          </p>
        </div>

        {showSetupOnly && (
          <div className="rounded-2xl border border-amber-500/25 bg-[#111114]/90 backdrop-blur-sm p-6 mb-8">
            <h2 className="text-lg font-bold text-white mb-2">Setup Required</h2>
            <p className="text-sm text-[#A0A0A8] mb-4">
              World Explorer uses 3D geospatial data. You need a free Cesium Ion token to get started.
            </p>
            <ol className="text-sm text-[#C8C8D0] space-y-2 list-decimal list-inside mb-6">
              <li>
                Create a free account at{" "}
                <a
                  href="https://cesium.com/ion"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2196F3] hover:underline"
                >
                  cesium.com/ion
                </a>
              </li>
              <li>Go to Access Tokens and create a new token</li>
              <li>Paste your token below</li>
            </ol>
            <label className="block text-xs font-medium text-[#A0A0A8] mb-2">Your Cesium Ion Token</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="password"
                autoComplete="off"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
                className="flex-1 px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/10 text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/50 transition text-sm font-mono"
              />
              <button
                type="button"
                onClick={saveToken}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#2196F3] to-[#1976D2] text-white font-semibold text-sm hover:brightness-110 transition"
              >
                Save Token
              </button>
            </div>
          </div>
        )}

        {!showSetupOnly && (
          <>
            <div className="rounded-2xl border border-white/10 bg-[#111114]/80 backdrop-blur-sm p-6 mb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a location… (e.g. Paris France, Mount Everest, Dubai)"
                  className="flex-1 px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/10 text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/50 transition text-sm"
                />
                <button
                  type="button"
                  onClick={() => lookup(query)}
                  disabled={loadingCoords || !query.trim()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#2196F3] to-[#1976D2] text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50"
                >
                  {loadingCoords ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  Find
                </button>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-medium text-[#606068] uppercase tracking-wider mb-2">Popular</p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setQuery(p);
                        lookup(p);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-[#A0A0A8] hover:bg-white/10 hover:text-white transition"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-[10px] font-medium text-[#606068] uppercase tracking-wider mb-2">
                  Quality
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as QualityMode)}
                  className="w-full sm:w-[360px] px-3 py-2 rounded-lg bg-[#0A0A0B] border border-white/10 text-white text-sm outline-none focus:border-[#2196F3]/50"
                >
                  <option value="performance">
                    Performance (SSE 8, Frustum Culling On, 1GB Cache)
                  </option>
                  <option value="balanced">
                    Balanced (SSE 2, Frustum Culling On, 2GB Cache)
                  </option>
                  <option value="ultra">
                    Ultra (SSE 0.5, Frustum Culling Off, 4GB Cache, 50 loads)
                  </option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-8">
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Token saved</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingToken(true)}
                className="text-sm text-[#2196F3] hover:underline text-left sm:text-right"
              >
                Change token
              </button>
            </div>

            <div className="mb-6 rounded-xl border border-[#2196F3]/25 bg-[#0E1620]/70 px-4 py-3">
              <p className="text-xs text-[#BFDFFF]">
                Tip: For best quality, wait 30-60 seconds after import for all tiles to fully load. Move camera slowly for tiles to stream in.
              </p>
            </div>

            {(loadingCoords || coords) && (
              <div className="rounded-2xl border border-[#2196F3]/20 bg-[#111114]/80 p-6 mb-8">
                <h3 className="text-sm font-semibold text-white mb-3">Preview</h3>
                {loadingCoords ? (
                  <div className="flex items-center gap-2 text-sm text-[#A0A0A8]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#2196F3]" />
                    Looking up coordinates…
                  </div>
                ) : coords ? (
                  <div className="space-y-3">
                    <p className="text-sm text-white">{resolvedLabel}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-[#A0A0A8]">
                      <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                        Lat: {coords.lat.toFixed(6)}
                      </span>
                      <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                        Lon: {coords.lon.toFixed(6)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3 items-center pt-2">
                      <select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-[#0A0A0B] border border-white/10 text-white text-sm outline-none focus:border-[#2196F3]/50"
                      >
                        <option value="">Select project…</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleImport}
                        disabled={importing || !projectId}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2196F3] text-white text-sm font-semibold hover:bg-[#2196F3]/90 transition disabled:opacity-50"
                      >
                        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                        Import to UE5
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
