"use client";

import { useState } from "react";
import { Search, Loader2, Globe, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/stores/uiStore";
import { useProjectStore } from "@/lib/stores/projectStore";
import { getClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface SketchfabResult {
  id: string;
  name: string;
  author: string;
  thumbnail: string | null;
  viewCount: number;
  url: string;
}

interface SketchfabSearchModalProps {
  projectId: string;
}

export function SketchfabSearchModal({ projectId }: SketchfabSearchModalProps) {
  const open = useUIStore((s) => s.sketchfabModalOpen);
  const setOpen = useUIStore((s) => s.setSketchfabModalOpen);
  const addChatTurn = useProjectStore((s) => s.addChatTurn);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SketchfabResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tools/sketchfab?q=${encodeURIComponent(query.trim())}`);
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
    <Dialog open={open} onOpenChange={(o) => setOpen(!!o)}>
      <DialogContent className="bg-boss-card border-boss-border max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-text-primary">
            <Globe className="w-5 h-5 text-agent-teal" />
            Sketchfab Search
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Search free 3D models (e.g. car, tree, character)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="bg-boss-surface border-boss-border text-text-primary"
          />
          <Button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="bg-agent-teal hover:bg-agent-teal/90 text-white shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
          {results.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {results.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-boss-border bg-boss-surface overflow-hidden group"
                >
                  {r.thumbnail ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.thumbnail}
                      alt={r.name}
                      className="w-full h-24 object-cover"
                    />
                  ) : (
                    <div className="w-full h-24 bg-boss-elevated flex items-center justify-center text-text-muted text-2xl">
                      📦
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs font-medium text-text-primary truncate" title={r.name}>
                      {r.name}
                    </p>
                    <p className="text-[10px] text-text-muted truncate">{r.author}</p>
                    <p className="text-[10px] text-text-muted">{r.viewCount} views</p>
                    <div className="flex gap-1 mt-1.5">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-agent-teal hover:underline"
                      >
                        View
                      </a>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-[10px] text-gold hover:bg-gold/10"
                        onClick={() => suggestToTeam(r)}
                      >
                        <MessageSquare className="w-3 h-3 mr-0.5" />
                        Suggest to Team
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-text-muted text-sm">
              Search for free 3D models to import into UE5
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
