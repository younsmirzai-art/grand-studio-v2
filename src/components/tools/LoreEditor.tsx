"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getClient } from "@/lib/supabase/client";
import type { GameLoreEntry } from "@/lib/agents/types";

interface LoreEditorProps {
  projectId: string;
}

export function LoreEditor({ projectId }: LoreEditorProps) {
  const [entries, setEntries] = useState<GameLoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = getClient();
    supabase
      .from("game_lore")
      .select("*")
      .eq("project_id", projectId)
      .order("category")
      .then(({ data }) => {
        if (data) setEntries(data as GameLoreEntry[]);
        setLoading(false);
      });
  }, [projectId]);

  const handleAdd = async () => {
    if (!newCategory.trim() || !newKey.trim() || !newValue.trim()) return;
    setSaving(true);

    const supabase = getClient();
    const { data, error } = await supabase
      .from("game_lore")
      .upsert({
        project_id: projectId,
        category: newCategory.trim(),
        key: newKey.trim(),
        value: newValue.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setEntries((prev) => [...prev.filter((e) => !(e.category === data.category && e.key === data.key)), data as GameLoreEntry]);
      setNewCategory("");
      setNewKey("");
      setNewValue("");
    }
    setSaving(false);
  };

  const categories = [...new Set(entries.map((e) => e.category))];

  return (
    <div className="bg-boss-card border border-boss-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-boss-border">
        <BookOpen className="w-4 h-4 text-agent-amber" />
        <span className="text-sm font-medium text-text-primary">Game Lore / GDD</span>
      </div>

      <div className="p-4 space-y-4 max-h-96 overflow-y-auto scrollbar-thin">
        {loading ? (
          <p className="text-text-muted text-sm">Loading...</p>
        ) : categories.length === 0 ? (
          <p className="text-text-muted text-sm">No lore entries yet</p>
        ) : (
          categories.map((cat) => (
            <div key={cat}>
              <h4 className="text-xs font-medium text-agent-amber uppercase tracking-wider mb-2">
                {cat}
              </h4>
              <div className="space-y-1">
                {entries
                  .filter((e) => e.category === cat)
                  .map((entry) => (
                    <div
                      key={`${entry.category}-${entry.key}`}
                      className="flex gap-2 text-xs bg-boss-surface rounded-lg p-2"
                    >
                      <span className="text-text-secondary font-medium shrink-0">
                        {entry.key}:
                      </span>
                      <span className="text-text-primary">{entry.value}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-boss-border p-3 space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="bg-boss-surface border-boss-border text-xs h-8"
          />
          <Input
            placeholder="Key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="bg-boss-surface border-boss-border text-xs h-8"
          />
        </div>
        <Textarea
          placeholder="Value..."
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          rows={2}
          className="bg-boss-surface border-boss-border text-xs resize-none"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={saving || !newCategory.trim() || !newKey.trim() || !newValue.trim()}
          className="w-full bg-agent-amber/10 hover:bg-agent-amber/20 text-agent-amber border border-agent-amber/20 gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add Lore Entry
        </Button>
      </div>
    </div>
  );
}
