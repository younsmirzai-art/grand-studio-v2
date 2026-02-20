"use client";

import { useEffect } from "react";
import { getClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/lib/stores/projectStore";
import type { GodEyeEntry } from "@/lib/agents/types";

export function useRealtimeGodEye(projectId: string | null) {
  const { setGodEyeLog, addGodEyeEntry } = useProjectStore();

  useEffect(() => {
    if (!projectId) return;

    const supabase = getClient();

    supabase
      .from("god_eye_log")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (data) setGodEyeLog(data as GodEyeEntry[]);
      });

    const channel = supabase
      .channel(`godeye:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "god_eye_log",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          addGodEyeEntry(payload.new as GodEyeEntry);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, setGodEyeLog, addGodEyeEntry]);
}
