"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Save, Loader2, Trash2, ArrowLeft, Wifi, WifiOff, AlertTriangle, Gamepad2, Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProjectStore } from "@/lib/stores/projectStore";
import { getClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";
import { TEAM } from "@/lib/agents/identity";
import { gamePresets, generatePresetCode } from "@/lib/gameDNA/presets";
import { PixelStreamingSetup } from "@/components/tools/PixelStreamingSetup";
import { getCurrentUser } from "@/lib/collaboration/user";

const GENRES = ["Action", "RPG", "FPS", "Open World", "Platformer", "Puzzle", "Strategy", "Other"];
const PLATFORMS = ["PC", "Console", "Mobile", "Multi-platform"];
const LANGUAGES = ["English", "Persian", "Other"];
const RESPONSE_LENGTHS = ["Short", "Medium", "Detailed"];

interface ProjectSettings {
  genre: string;
  platform: string;
  language: string;
  response_length: string;
  active_agents: string[];
  ue5_host: string;
  debug_mode_auto: boolean;
  pixel_streaming_url: string;
  pixel_streaming_connected: boolean;
}

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const isRelayConnected = useProjectStore((s) => s.isRelayConnected);

  const [name, setName] = useState(project?.name ?? "");
  const [summary, setSummary] = useState(project?.summary ?? "");
  const [settings, setSettings] = useState<ProjectSettings>({
    genre: "action",
    platform: "pc",
    language: "en",
    response_length: "medium",
    active_agents: TEAM.map((a) => a.name.toLowerCase()),
    ue5_host: "localhost:30010",
    debug_mode_auto: true,
    pixel_streaming_url: "ws://localhost:8888",
    pixel_streaming_connected: false,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gameStyleApplying, setGameStyleApplying] = useState(false);
  const [pixelStreamingSetupOpen, setPixelStreamingSetupOpen] = useState(false);
  const [testingPixelStreaming, setTestingPixelStreaming] = useState(false);
  const [collaborators, setCollaborators] = useState<{ id: string; user_email: string; display_name: string | null; permission: string; status: string }[]>([]);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState<"editor" | "viewer">("editor");
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setSummary(project.summary ?? "");
    }
  }, [project?.id, project?.name, project?.summary]);

  const fetchCollaborators = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/collaborators`);
      const data = await res.json();
      if (res.ok && data.collaborators) setCollaborators(data.collaborators);
      else setCollaborators([]);
    } catch {
      setCollaborators([]);
    }
  }, [projectId]);

  useEffect(() => {
    const load = async () => {
      const supabase = getClient();
      const { data } = await supabase
        .from("project_settings")
        .select("*")
        .eq("project_id", projectId)
        .single();
      if (data) {
        setSettings({
          genre: data.genre ?? "action",
          platform: data.platform ?? "pc",
          language: data.language ?? "en",
          response_length: data.response_length ?? "medium",
          active_agents: data.active_agents ?? TEAM.map((a) => a.name.toLowerCase()),
          ue5_host: data.ue5_host ?? "localhost:30010",
          debug_mode_auto: data.debug_mode_auto !== false,
          pixel_streaming_url: data.pixel_streaming_url ?? "ws://localhost:8888",
          pixel_streaming_connected: data.pixel_streaming_connected === true,
        });
      }
      setLoading(false);
    };
    load();
  }, [projectId]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  const handleSave = async () => {
    setSaving(true);
    const supabase = getClient();

    const { error: projErr } = await supabase
      .from("projects")
      .update({ name: name.trim(), summary: summary.trim(), updated_at: new Date().toISOString() })
      .eq("id", projectId);

    if (projErr) {
      toast.error("Failed to update project");
      setSaving(false);
      return;
    }

    const { error: setErr } = await supabase.from("project_settings").upsert(
      {
        project_id: projectId,
        genre: settings.genre,
        platform: settings.platform,
        language: settings.language,
        response_length: settings.response_length,
        active_agents: settings.active_agents,
        ue5_host: settings.ue5_host,
        debug_mode_auto: settings.debug_mode_auto,
        pixel_streaming_url: settings.pixel_streaming_url,
        pixel_streaming_connected: settings.pixel_streaming_connected,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" }
    );

    if (!setErr) {
      setProject({ ...project!, name: name.trim(), summary: summary.trim() });
      toast.success("Settings saved");
    } else toast.error("Failed to save settings");
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project? This cannot be undone.")) return;
    const supabase = getClient();
    await supabase.from("projects").delete().eq("id", projectId);
    toast.success("Project deleted");
    router.push("/");
  };

  const toggleAgent = (agentName: string) => {
    const lower = agentName.toLowerCase();
    setSettings((s) => ({
      ...s,
      active_agents: s.active_agents.includes(lower)
        ? s.active_agents.filter((a) => a !== lower)
        : [...s.active_agents, lower],
    }));
  };

  const deleteChatHistory = async () => {
    if (!confirm("Delete all chat history? This cannot be undone.")) return;
    const supabase = getClient();
    await supabase.from("chat_turns").delete().eq("project_id", projectId);
    toast.success("Chat history deleted");
  };

  const applyGameStyle = async (presetKey: string) => {
    const preset = gamePresets[presetKey];
    if (!preset) return;
    setGameStyleApplying(true);
    try {
      const code = generatePresetCode(preset);
      const res = await fetch("/api/ue5/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, code, agentName: "Boss" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to apply game style");
        return;
      }
      toast.success(`Applied: ${preset.name}`);
    } catch {
      toast.error("Failed to send style to UE5");
    } finally {
      setGameStyleApplying(false);
    }
  };

  if (loading) return <div className="p-8 text-text-muted">Loading...</div>;

  return (
    <div className="p-8 max-w-2xl">
      <Link
        href={`/project/${projectId}`}
        className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to project
      </Link>

      <h2 className="text-xl font-bold text-text-primary mb-6">Project Settings</h2>

      <div className="space-y-8">
        {/* PROJECT INFO */}
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Project Info</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Project Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-boss-card border-boss-border text-text-primary" />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Description</label>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="bg-boss-card border-boss-border text-text-primary resize-none" />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Game Genre</label>
              <select
                value={settings.genre}
                onChange={(e) => setSettings((s) => ({ ...s, genre: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-boss-card border border-boss-border text-text-primary text-sm"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g.toLowerCase()}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Target Platform</label>
              <select
                value={settings.platform}
                onChange={(e) => setSettings((s) => ({ ...s, platform: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-boss-card border border-boss-border text-text-primary text-sm"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p.toLowerCase()}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* AGENT SETTINGS */}
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Agent Settings</h3>
          <div className="space-y-2">
            <p className="text-xs text-text-muted mb-2">Toggle agents on/off</p>
            {TEAM.map((a) => (
              <label key={a.name} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.active_agents.includes(a.name.toLowerCase())}
                  onChange={() => toggleAgent(a.name)}
                  className="rounded border-boss-border"
                />
                <span className="text-sm text-text-secondary">{a.name} ({a.title})</span>
              </label>
            ))}
            <div className="pt-2">
              <label className="text-xs text-text-secondary mb-1 block">Language</label>
              <select
                value={settings.language}
                onChange={(e) => setSettings((s) => ({ ...s, language: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-boss-card border border-boss-border text-text-primary text-sm"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l === "English" ? "en" : l === "Persian" ? "fa" : "en"}>{l}</option>
                ))}
              </select>
            </div>
            <div className="pt-2">
              <label className="text-xs text-text-secondary mb-1 block">Response Length</label>
              <select
                value={settings.response_length}
                onChange={(e) => setSettings((s) => ({ ...s, response_length: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-boss-card border border-boss-border text-text-primary text-sm"
              >
                {RESPONSE_LENGTHS.map((r) => (
                  <option key={r} value={r.toLowerCase()}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* GAME STYLE (Game DNA) */}
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Gamepad2 className="w-4 h-4" />
            Game Style
          </h3>
          <p className="text-xs text-text-muted mb-2">Apply lighting/atmosphere from famous game presets. Sends Python to UE5.</p>
          <div className="flex flex-wrap gap-2">
            <select
              value=""
              onChange={(e) => {
                const v = e.target.value;
                e.target.value = "";
                if (v) applyGameStyle(v);
              }}
              disabled={gameStyleApplying}
              className="px-3 py-2 rounded-lg bg-boss-card border border-boss-border text-text-primary text-sm min-w-[180px]"
            >
              <option value="">Select preset to apply…</option>
              {Object.entries(gamePresets).map(([key, preset]) => (
                <option key={key} value={key}>{preset.name}</option>
              ))}
            </select>
            {gameStyleApplying && <Loader2 className="w-4 h-4 animate-spin text-text-muted" />}
          </div>
        </section>

        {/* UE5 BRIDGE */}
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3">UE5 Bridge</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {isRelayConnected ? <Wifi className="w-4 h-4 text-agent-green" /> : <WifiOff className="w-4 h-4 text-text-muted" />}
              <span className="text-sm">{isRelayConnected ? "Connected" : "Disconnected"}</span>
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">UE5 Host URL</label>
              <Input
                value={settings.ue5_host}
                onChange={(e) => setSettings((s) => ({ ...s, ue5_host: e.target.value }))}
                className="bg-boss-card border-boss-border text-text-primary font-mono text-sm"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <label className="text-xs text-text-secondary block">Debug Mode</label>
                <p className="text-xs text-text-muted mt-0.5">When ON, Morgan auto-debugs UE5 errors and retries with a fix. When OFF, errors only show in chat.</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={settings.debug_mode_auto}
                  onChange={(e) => setSettings((s) => ({ ...s, debug_mode_auto: e.target.checked }))}
                  className="rounded border-boss-border"
                />
                <span className="text-sm text-text-primary">{settings.debug_mode_auto ? "ON" : "OFF"}</span>
              </label>
            </div>
          </div>
        </section>

        {/* UE5 Pixel Streaming */}
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3">UE5 Pixel Streaming</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Signaling Server URL</label>
              <Input
                value={settings.pixel_streaming_url}
                onChange={(e) => setSettings((s) => ({ ...s, pixel_streaming_url: e.target.value }))}
                placeholder="ws://localhost:8888"
                className="bg-boss-card border-boss-border text-text-primary font-mono text-sm"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                disabled={testingPixelStreaming}
                onClick={async () => {
                  setTestingPixelStreaming(true);
                  try {
                    const res = await fetch("/api/tools/pixel-streaming-test", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ url: settings.pixel_streaming_url }),
                    });
                    const data = await res.json();
                    const connected = data.connected === true;
                    setSettings((s) => ({ ...s, pixel_streaming_connected: connected }));
                    const supabase = getClient();
                    await supabase.from("project_settings").upsert(
                      {
                        project_id: projectId,
                        pixel_streaming_connected: connected,
                        updated_at: new Date().toISOString(),
                      },
                      { onConflict: "project_id" }
                    );
                    if (connected) toast.success("Pixel Streaming connected");
                    else toast.info("Could not connect. Ensure UE5 is running with Pixel Streaming.");
                  } catch {
                    setSettings((s) => ({ ...s, pixel_streaming_connected: false }));
                    toast.error("Test failed");
                  } finally {
                    setTestingPixelStreaming(false);
                  }
                }}
                className="border-boss-border"
              >
                {testingPixelStreaming ? "Testing…" : "Test Connection"}
              </Button>
              <span className={`text-xs ${settings.pixel_streaming_connected ? "text-agent-green" : "text-text-muted"}`}>
                Status: {settings.pixel_streaming_connected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              <button
                type="button"
                onClick={() => setPixelStreamingSetupOpen(true)}
                className="text-agent-teal hover:underline"
              >
                How to set up Pixel Streaming
              </button>
            </p>
          </div>
        </section>

        <PixelStreamingSetup open={pixelStreamingSetupOpen} onOpenChange={setPixelStreamingSetupOpen} />

        {/* Share */}
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Share
          </h3>
          <p className="text-xs text-text-muted mb-3">
            Invite people by email. Owner: full control. Editor: chat, UE5, playtest. Viewer: read-only.
          </p>
          <div className="space-y-3 mb-3">
            {collaborators.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-boss-border/50">
                <div>
                  <span className="text-sm text-text-primary">{c.display_name || c.user_email}</span>
                  <span className="text-xs text-text-muted ml-2">({c.permission})</span>
                  {c.status === "pending" && <span className="text-xs text-amber-500 ml-2">Pending</span>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-text-muted hover:text-agent-rose h-7 text-xs"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/projects/${projectId}/collaborators/${encodeURIComponent(c.user_email)}`, { method: "DELETE" });
                      if (res.ok) {
                        fetchCollaborators();
                        toast.success("Removed");
                      } else toast.error("Failed");
                    } catch {
                      toast.error("Failed");
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <Input
              type="email"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              placeholder="Email to invite"
              className="w-56 bg-boss-card border-boss-border text-text-primary"
            />
            <select
              value={sharePermission}
              onChange={(e) => setSharePermission(e.target.value as "editor" | "viewer")}
              className="h-9 px-3 rounded-lg bg-boss-card border border-boss-border text-text-primary text-sm"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button
              size="sm"
              disabled={sendingInvite || !shareEmail.trim()}
              onClick={async () => {
                const { userEmail } = getCurrentUser();
                if (!userEmail.trim()) {
                  toast.error("Set your email in Team page first");
                  return;
                }
                setSendingInvite(true);
                try {
                  const res = await fetch(`/api/projects/${projectId}/collaborators`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userEmail: shareEmail.trim(),
                      permission: sharePermission,
                      invitedBy: userEmail.trim(),
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setShareEmail("");
                    fetchCollaborators();
                    toast.success("Invite sent");
                  } else toast.error(data.error ?? "Failed");
                } catch {
                  toast.error("Failed");
                } finally {
                  setSendingInvite(false);
                }
              }}
              className="gap-2"
            >
              {sendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Invite
            </Button>
          </div>
        </section>

        {/* API */}
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3">API</h3>
          <p className="text-xs text-text-muted">OpenRouter API key: •••••••••••••••••</p>
          <p className="text-xs text-text-muted mt-1">Configure in Vercel environment variables.</p>
        </section>

        {/* DANGER ZONE */}
        <section className="border-t border-boss-border pt-6">
          <h3 className="text-sm font-semibold text-agent-rose mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
          </h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={deleteChatHistory} className="border-agent-amber/30 text-agent-amber hover:bg-agent-amber/10">
              Delete Chat History
            </Button>
            <Button variant="outline" onClick={handleDelete} className="border-agent-rose/30 text-agent-rose hover:bg-agent-rose/10 gap-2">
              <Trash2 className="w-4 h-4" />
              Delete Project
            </Button>
          </div>
        </section>

        <div className="flex gap-3 pt-4">
          <Button onClick={handleSave} disabled={saving} className="bg-gold hover:bg-gold/90 text-boss-bg font-semibold gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
