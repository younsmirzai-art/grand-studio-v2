"use client";

import { useEffect, useCallback } from "react";
import { getClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/lib/stores/projectStore";
import type { UE5Command } from "@/lib/agents/types";

export function useUE5Status(projectId: string | null) {
  const { setUE5Commands, addUE5Command, updateUE5Command, setRelayConnected } =
    useProjectStore();

  const checkRelayConnection = useCallback(
    (commands: UE5Command[]) => {
      const recentExecuted = commands.find(
        (c) => c.status === "success" || c.status === "error"
      );
      if (recentExecuted?.executed_at) {
        const age = Date.now() - new Date(recentExecuted.executed_at).getTime();
        setRelayConnected(age < 60_000);
      }
    },
    [setRelayConnected]
  );

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
        if (data) {
          const typed = data as UE5Command[];
          setUE5Commands(typed);
          checkRelayConnection(typed);
        }
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
          if (updated.status === "success" || updated.status === "error") {
            setRelayConnected(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, setUE5Commands, addUE5Command, updateUE5Command, checkRelayConnection, setRelayConnected]);
}
