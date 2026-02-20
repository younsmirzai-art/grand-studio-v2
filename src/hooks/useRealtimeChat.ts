"use client";

import { useEffect } from "react";
import { getClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/lib/stores/projectStore";
import type { ChatTurn } from "@/lib/agents/types";

export function useRealtimeChat(projectId: string | null) {
  const { setChatTurns, addChatTurn } = useProjectStore();

  useEffect(() => {
    if (!projectId) return;

    const supabase = getClient();

    supabase
      .from("chat_turns")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setChatTurns(data as ChatTurn[]);
      });

    const channel = supabase
      .channel(`chat:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_turns",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          addChatTurn(payload.new as ChatTurn);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, setChatTurns, addChatTurn]);
}
