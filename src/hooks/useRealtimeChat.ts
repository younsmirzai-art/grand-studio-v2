"use client";

import { useEffect, useCallback } from "react";
import { getClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/lib/stores/projectStore";
import type { ChatTurn } from "@/lib/agents/types";

export function useRealtimeChat(projectId: string | null) {
  const { setChatTurns, addChatTurn } = useProjectStore();

  const refetchChat = useCallback(async () => {
    if (!projectId) return;
    const supabase = getClient();
    const { data, error } = await supabase
      .from("chat_turns")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[RealtimeChat] refetch error:", error);
      return;
    }
    if (data) {
      console.log("[RealtimeChat] refetched", data.length, "chat turns");
      setChatTurns(data as ChatTurn[]);
    }
  }, [projectId, setChatTurns]);

  useEffect(() => {
    if (!projectId) return;

    const supabase = getClient();

    supabase
      .from("chat_turns")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("[RealtimeChat] initial fetch error:", error);
        }
        if (data) {
          console.log("[RealtimeChat] initial load:", data.length, "chat turns");
          setChatTurns(data as ChatTurn[]);
        }
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
          console.log("[RealtimeChat] realtime INSERT received:", payload.new);
          addChatTurn(payload.new as ChatTurn);
        }
      )
      .subscribe((status, err) => {
        console.log("[RealtimeChat] subscription status:", status);
        if (err) {
          console.error("[RealtimeChat] subscription error:", err);
        }
        if (status === "CHANNEL_ERROR") {
          console.error("[RealtimeChat] channel error — falling back to polling");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, setChatTurns, addChatTurn]);

  return { refetchChat };
}
