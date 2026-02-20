"use client";

import { useEffect, useState } from "react";
import { Globe, ChevronRight } from "lucide-react";
import { getClient } from "@/lib/supabase/client";
import type { WorldStateEntity } from "@/lib/agents/types";
import { Skeleton } from "@/components/ui/skeleton";

interface WorldStateViewProps {
  projectId: string;
}

export function WorldStateView({ projectId }: WorldStateViewProps) {
  const [entities, setEntities] = useState<WorldStateEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const supabase = getClient();
    supabase
      .from("world_state")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (data) setEntities(data as WorldStateEntity[]);
        setLoading(false);
      });

    const channel = supabase
      .channel(`world:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "world_state",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          supabase
            .from("world_state")
            .select("*")
            .eq("project_id", projectId)
            .order("updated_at", { ascending: false })
            .then(({ data }) => {
              if (data) setEntities(data as WorldStateEntity[]);
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 bg-boss-elevated rounded-lg" />
        ))}
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-muted">
        <Globe className="w-8 h-8 mb-2" />
        <p className="text-sm">No world entities yet</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {entities.map((entity) => (
        <div
          key={entity.id}
          className="bg-boss-card border border-boss-border rounded-lg overflow-hidden"
        >
          <button
            onClick={() => setExpanded(expanded === entity.id ? null : entity.id)}
            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-boss-elevated/30 transition-colors"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 text-text-muted transition-transform ${expanded === entity.id ? "rotate-90" : ""}`}
            />
            <span className="text-xs font-medium text-agent-teal">
              {entity.entity_type}
            </span>
            <span className="text-xs text-text-secondary">{entity.entity_id}</span>
          </button>
          {expanded === entity.id && (
            <div className="px-3 pb-3 border-t border-boss-border">
              <pre className="text-[11px] font-mono text-text-secondary mt-2 overflow-x-auto">
                {JSON.stringify(entity.attributes, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
