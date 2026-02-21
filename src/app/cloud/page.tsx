"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Crown, Monitor, Cloud, Loader2, BookOpen, Settings, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

import { CLOUD_SESSION_KEY } from "@/lib/cloud/constants";

const CLOUD_SETTINGS_KEY = "grand_studio_cloud_settings";
const REGIONS = [
  { value: "auto", label: "Auto" },
  { value: "us-east", label: "US-East" },
  { value: "us-west", label: "US-West" },
  { value: "eu-west", label: "EU-West" },
  { value: "asia", label: "Asia" },
];
const IDLE_OPTIONS = [
  { value: "5", label: "5 min" },
  { value: "10", label: "10 min" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
];
const GPU_OPTIONS = [
  { value: "t4", label: "T4 (Standard)" },
  { value: "a10g", label: "A10G (Performance)" },
];

interface CloudSettings {
  autoShutdownMinutes: string;
  defaultGpu: string;
  defaultRegion: string;
}

function loadSettings(): CloudSettings {
  if (typeof window === "undefined")
    return { autoShutdownMinutes: "10", defaultGpu: "t4", defaultRegion: "auto" };
  try {
    const s = localStorage.getItem(CLOUD_SETTINGS_KEY);
    if (s) return { ...{ autoShutdownMinutes: "10", defaultGpu: "t4", defaultRegion: "auto" }, ...JSON.parse(s) };
  } catch {}
  return { autoShutdownMinutes: "10", defaultGpu: "t4", defaultRegion: "auto" };
}

function saveSettings(settings: CloudSettings) {
  try {
    localStorage.setItem(CLOUD_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

interface SessionRow {
  id: string;
  project_id: string | null;
  status: string;
  gpu_type: string;
  started_at: string | null;
  total_minutes_used: number | null;
  created_at: string;
}

interface UsageData {
  tier: string;
  minutesUsed: number;
  limit: number | null;
  sessions: SessionRow[];
  resetsOn: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(minutes: number | null, startedAt: string | null) {
  if (minutes != null && minutes >= 0) return `${minutes} min`;
  if (startedAt) {
    const m = Math.ceil((Date.now() - new Date(startedAt).getTime()) / 60000);
    return `${m} min`;
  }
  return "—";
}

export default function CloudPage() {
  const [userEmail, setUserEmail] = useState("");
  const [relayOnline, setRelayOnline] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [startSessionLoading, setStartSessionLoading] = useState(false);
  const [settings, setSettings] = useState<CloudSettings>(loadSettings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const fetchRelay = useCallback(async () => {
    try {
      const res = await fetch("/api/ue5/status");
      const data = await res.json();
      setRelayOnline(data.relay_online === true);
    } catch {
      setRelayOnline(false);
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    if (!userEmail.trim()) {
      setUsage(null);
      return;
    }
    setUsageLoading(true);
    try {
      const res = await fetch(
        `/api/cloud/usage?userEmail=${encodeURIComponent(userEmail.trim())}`
      );
      const data = await res.json();
      if (res.ok) {
        setUsage({
          tier: data.tier,
          minutesUsed: data.minutesUsed ?? 0,
          limit: data.limit ?? null,
          sessions: data.sessions ?? [],
          resetsOn: data.resetsOn ?? "",
        });
      } else {
        setUsage(null);
      }
    } catch {
      setUsage(null);
    } finally {
      setUsageLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    fetchRelay();
    const t = setInterval(fetchRelay, 10000);
    return () => clearInterval(t);
  }, [fetchRelay]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const canUseCloud = usage && usage.tier !== "starter";
  const minutesLeft =
    usage && usage.limit != null ? Math.max(0, usage.limit - usage.minutesUsed) : null;
  const noMinutesLeft = usage && usage.limit != null && usage.minutesUsed >= usage.limit;

  const usagePct =
    usage && usage.limit != null && usage.limit > 0
      ? Math.min(100, (usage.minutesUsed / usage.limit) * 100)
      : 0;
  const usageBarColor =
    usagePct >= 80 ? "bg-red-500" : usagePct >= 60 ? "bg-yellow-500" : "bg-green-500";

  const handleStartCloudSession = async () => {
    if (!userEmail.trim() || startSessionLoading) return;
    if (!canUseCloud) {
      toast.error("Upgrade to Pro to use Cloud UE5");
      return;
    }
    if (noMinutesLeft) {
      toast.error("Monthly cloud minutes exhausted. Upgrade your plan.");
      return;
    }
    setStartSessionLoading(true);
    try {
      const res = await fetch("/api/cloud/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: userEmail.trim(),
          gpuType: settings.defaultGpu,
          region: settings.defaultRegion,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to start session");
        return;
      }
      if (data.sessionId) {
        try {
          localStorage.setItem(CLOUD_SESSION_KEY, data.sessionId);
        } catch {}
      }
      toast.success(data.message ?? "Session starting (Cloud UE5 coming soon!)");
      fetchUsage();
    } catch (e) {
      toast.error("Failed to start session");
    } finally {
      setStartSessionLoading(false);
    }
  };

  const handleSaveSettings = () => {
    saveSettings(settings);
    setSettingsSaved(true);
    toast.success("Settings saved");
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const resetsOnFormatted = usage?.resetsOn
    ? new Date(usage.resetsOn).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "1st of next month";

  return (
    <div className="min-h-screen bg-boss-bg">
      <nav className="sticky top-0 z-40 border-b border-boss-border bg-boss-surface/95 glass-strong">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-primary">
            <Crown className="w-4 h-4 text-gold" />
            <span className="font-bold text-sm">Grand Studio</span>
          </Link>
          <div className="flex gap-2">
            <Link href="/cloud">
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                Cloud
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                Marketplace
              </Button>
            </Link>
            <Link href="/developer">
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                API
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Cloud className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Cloud UE5 — Build games without installing anything
            </h1>
            <p className="text-text-muted text-sm mt-0.5">
              Run UE5 in the cloud or use your local PC. Choose your mode below.
            </p>
          </div>
        </div>

        {/* Email for cloud / usage */}
        <div className="mb-6 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-text-muted text-xs mb-1">Your email (for Cloud & usage)</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="mt-1 max-w-xs bg-boss-surface border-boss-border text-text-primary"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsage}
            disabled={usageLoading || !userEmail.trim()}
            className="border-boss-border text-text-secondary"
          >
            {usageLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>

        {/* Two mode cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Local */}
          <div className="rounded-2xl border border-boss-border bg-boss-card p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-boss-elevated flex items-center justify-center">
                <Monitor className="w-5 h-5 text-text-secondary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Local UE5</h2>
                <p className="text-xs text-text-muted">Free forever</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              Run UE5 on your own PC. Free forever.
            </p>
            <p className="text-xs text-text-muted mb-4">
              Requirements: Gaming PC + UE5 installed + relay.py running
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-3">
              <Link href="/docs/local-setup" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-boss-border gap-2">
                  <BookOpen className="w-3.5 h-3.5" />
                  Setup Guide
                </Button>
              </Link>
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${
                  relayOnline === true
                    ? "bg-agent-green/20 text-agent-green"
                    : relayOnline === false
                    ? "bg-boss-elevated text-text-muted"
                    : "bg-boss-elevated text-text-muted"
                }`}
              >
                {relayOnline === true ? "Active ✅" : "Not Connected ⚫"}
              </span>
            </div>
          </div>

          {/* Cloud */}
          <div className="rounded-2xl border border-boss-border bg-boss-card p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Cloud className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Cloud UE5</h2>
                <p className="text-xs text-text-muted">Pro+</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary mb-2">
              We run UE5 for you. Just open your browser.
            </p>
            <p className="text-xs text-text-muted mb-3">
              Pro: 60 min/mo · Studio: 300 min/mo · Enterprise: Unlimited
            </p>
            <p className="text-xs text-text-muted mb-3">
              GPU: NVIDIA T4 (Standard) · A10G (Performance)
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                value={settings.defaultRegion}
                onChange={(e) => setSettings((s) => ({ ...s, defaultRegion: e.target.value }))}
                className="w-[140px] h-8 rounded-md bg-boss-surface border border-boss-border text-text-primary text-xs px-2"
              >
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            {!canUseCloud && (
              <p className="text-xs text-amber-500 mb-2">
                Upgrade to Pro to use Cloud UE5
              </p>
            )}
            {canUseCloud && noMinutesLeft && (
              <p className="text-xs text-red-500 mb-2">
                Monthly limit reached. Upgrade for more minutes.
              </p>
            )}
            <div className="mt-auto flex flex-wrap gap-2">
              {canUseCloud && !noMinutesLeft ? (
                <Button
                  onClick={handleStartCloudSession}
                  disabled={startSessionLoading || !userEmail.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white gap-2 shadow-lg shadow-green-500/25"
                >
                  {startSessionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                  Start Cloud Session
                </Button>
              ) : (
                <Link href="/#pricing">
                  <Button className="bg-gold hover:bg-gold/90 text-boss-bg gap-2">
                    Upgrade to Pro
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Usage */}
        {usage && (
          <section className="rounded-2xl border border-boss-border bg-boss-card p-6 mb-8">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Usage this month</h2>
            {usage.limit != null ? (
              <>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">
                    {usage.minutesUsed}/{usage.limit} minutes used
                  </span>
                  <span className="text-text-muted">Resets on {resetsOnFormatted}</span>
                </div>
                <div className="h-3 rounded-full bg-boss-elevated overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usageBarColor}`}
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-text-muted">
                Enterprise: unlimited minutes. Resets on {resetsOnFormatted}.
              </p>
            )}
          </section>
        )}

        {/* Session history */}
        {usage && usage.sessions.length > 0 && (
          <section className="rounded-2xl border border-boss-border bg-boss-card p-6 mb-8">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Session history (last 10)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-muted border-b border-boss-border">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Duration</th>
                    <th className="pb-2 pr-4">Project</th>
                    <th className="pb-2 pr-4">GPU</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.sessions.map((s) => (
                    <tr key={s.id} className="border-b border-boss-border/50 text-text-secondary">
                      <td className="py-2 pr-4">{formatDate(s.created_at)}</td>
                      <td className="py-2 pr-4">
                        {formatDuration(s.total_minutes_used, s.started_at)}
                      </td>
                      <td className="py-2 pr-4">{s.project_id ? "—" : "—"}</td>
                      <td className="py-2 pr-4">{s.gpu_type ?? "—"}</td>
                      <td className="py-2">
                        <span
                          className={
                            s.status === "ended"
                              ? "text-text-muted"
                              : s.status === "active" || s.status === "starting"
                              ? "text-agent-green"
                              : "text-agent-amber"
                          }
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Settings */}
        <section className="rounded-2xl border border-boss-border bg-boss-card p-6">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5" />
            Settings
          </h2>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-text-muted text-xs mb-1">Auto-shutdown after idle</label>
              <select
                value={settings.autoShutdownMinutes}
                onChange={(e) => setSettings((s) => ({ ...s, autoShutdownMinutes: e.target.value }))}
                className="mt-1 w-full h-9 rounded-md bg-boss-surface border border-boss-border text-text-primary text-sm px-3"
              >
                {IDLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-text-muted text-xs mb-1">Default GPU</label>
              <select
                value={settings.defaultGpu}
                onChange={(e) => setSettings((s) => ({ ...s, defaultGpu: e.target.value }))}
                className="mt-1 w-full h-9 rounded-md bg-boss-surface border border-boss-border text-text-primary text-sm px-3"
              >
                {GPU_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-text-muted text-xs mb-1">Default region</label>
              <select
                value={settings.defaultRegion}
                onChange={(e) => setSettings((s) => ({ ...s, defaultRegion: e.target.value }))}
                className="mt-1 w-full h-9 rounded-md bg-boss-surface border border-boss-border text-text-primary text-sm px-3"
              >
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            onClick={handleSaveSettings}
            variant="outline"
            size="sm"
            className="border-boss-border text-text-secondary gap-2"
          >
            {settingsSaved ? <Check className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
            Save
          </Button>
        </section>
      </main>
    </div>
  );
}
