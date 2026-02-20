"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Save, Loader2, Trash2, ArrowLeft, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProjectStore } from "@/lib/stores/projectStore";
import { getClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";
import { TEAM } from "@/lib/agents/identity";

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
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setSummary(project.summary ?? "");
    }
  }, [project?.id, project?.name, project?.summary]);

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
        });
      }
      setLoading(false);
    };
    load();
  }, [projectId]);

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
