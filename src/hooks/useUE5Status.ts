"use client";

import { useEffect } from "react";
import { getClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/lib/stores/projectStore";
import type { UE5Command } from "@/lib/agents/types";

export function useUE5Status(projectId: string | null) {
  const { setUE5Commands, addUE5Command, updateUE5Command } = useProjectStore();

  useEffect(() => {
    if (!projectId) return;

    const supabase = getClient();

    supabase
      .from("ue5_commands")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setUE5Commands(data as UE5Command[]);
      });

    const channel = supabase
      .channel(`ue5:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ue5_commands",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          addUE5Command(payload.new as UE5Command);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ue5_commands",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const updated = payload.new as UE5Command;
          updateUE5Command(updated.id, updated);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, setUE5Commands, addUE5Command, updateUE5Command]);
}
