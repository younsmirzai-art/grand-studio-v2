"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Plus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/lib/stores/projectStore";
import { toast } from "sonner";

const CATEGORIES = ["Characters", "Locations", "Items", "Story", "Factions", "General"];

interface LoreEntry {
  id: string;
  project_id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  updated_at: string;
}

export default function LoreEditorPage() {
  const params = useParams();
  const projectId = params.id as string;
  const addChatTurn = useProjectStore((s) => s.addChatTurn);

  const [category, setCategory] = useState("General");
  const [entries, setEntries] = useState<LoreEntry[]>([]);
  const [selected, setSelected] = useState<LoreEntry | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshEntries = useCallback(async () => {
    const supabase = getClient();
    const { data } = await supabase
      .from("lore_entries")
      .select("*")
      .eq("project_id", projectId)
      .eq("category", category.toLowerCase())
      .order("updated_at", { ascending: false });
    setEntries((data as LoreEntry[]) ?? []);
  }, [projectId, category]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = getClient();
      const { data } = await supabase
        .from("lore_entries")
        .select("*")
        .eq("project_id", projectId)
        .eq("category", category.toLowerCase())
        .order("updated_at", { ascending: false });
      if (!cancelled) setEntries((data as LoreEntry[]) ?? []);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId, category]);

  const handleNew = () => {
    setSelected(null);
    setTitle("");
    setContent("");
  };

  const handleSelect = (e: LoreEntry) => {
    setSelected(e);
    setTitle(e.title);
    setContent(e.content);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content required");
      return;
    }
    setSaving(true);
    const supabase = getClient();
    const payload = {
      project_id: projectId,
      category: category.toLowerCase(),
      title: title.trim(),
      content: content.trim(),
      updated_at: new Date().toISOString(),
      created_by: "boss",
    };

    if (selected) {
      const { data, error } = await supabase
        .from("lore_entries")
        .update(payload)
        .eq("id", selected.id)
        .select()
        .single();
      if (!error && data) {
        setSelected(data as LoreEntry);
        toast.success("Updated");
      } else toast.error("Update failed");
    } else {
      const { data, error } = await supabase
        .from("lore_entries")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setSelected(data as LoreEntry);
        toast.success("Created");
      } else toast.error("Create failed");
    }
    setSaving(false);
    refreshEntries();
  };

  const shareWithTeam = async (e: LoreEntry) => {
    const message = `[LORE] **${e.title}** (${e.category})\n${e.content.slice(0, 300)}${e.content.length > 300 ? "..." : ""}`;
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
      toast.error("Failed to share");
      return;
    }
    if (data) addChatTurn(data);
    toast.success("Shared with team");
  };

  return (
    <div className="flex h-full">
      <aside className="w-48 border-r border-boss-border bg-boss-surface/50 p-3 shrink-0">
        <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Categories</p>
        <div className="space-y-0.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                category === c ? "bg-gold/10 text-gold" : "text-text-secondary hover:bg-boss-elevated"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-boss-border flex items-center justify-between">
          <Link
            href={`/project/${projectId}`}
            className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleNew} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              New
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 bg-gold hover:bg-gold/90 text-boss-bg">
              <Save className="w-3.5 h-3.5" />
              Save
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r border-boss-border overflow-y-auto scrollbar-thin p-3">
            <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Entries</p>
            {loading ? (
              <p className="text-text-muted text-sm">Loading...</p>
            ) : entries.length === 0 ? (
              <p className="text-text-muted text-sm">No entries yet</p>
            ) : (
              <div className="space-y-0.5">
                {entries.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => handleSelect(e)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                      selected?.id === e.id ? "bg-boss-elevated text-text-primary" : "text-text-secondary hover:bg-boss-elevated/50"
                    }`}
                  >
                    {e.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-2xl space-y-4">
              <div>
                <label className="text-sm text-text-secondary mb-1.5 block">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Entry title"
                  className="bg-boss-card border-boss-border text-text-primary"
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-1.5 block">Content (Markdown)</label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your lore..."
                  rows={16}
                  className="bg-boss-card border-boss-border text-text-primary font-mono text-sm resize-none"
                />
              </div>
              {selected && (
                <Button
                  variant="outline"
                  onClick={() => shareWithTeam(selected)}
                  className="gap-2 border-gold/30 text-gold hover:bg-gold/10"
                >
                  <MessageSquare className="w-4 h-4" />
                  Share with Team
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
