"use client";

import { useEffect, useCallback, useRef } from "react";
import { getClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/lib/stores/projectStore";
import type { ChatTurn } from "@/lib/types";

export function useRealtimeChat(projectId: string | null) {
  const { setChatTurns, addChatTurn } = useProjectStore();
  const seenIdsRef = useRef<Set<number>>(new Set());

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
      setChatTurns(data as ChatTurn[]);
      seenIdsRef.current = new Set(data.map((d) => (d as ChatTurn).id));
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
          setChatTurns(data as ChatTurn[]);
          seenIdsRef.current = new Set(data.map((d) => (d as ChatTurn).id));
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
          const turn = payload.new as ChatTurn;
          if (seenIdsRef.current.has(turn.id)) return;
          seenIdsRef.current.add(turn.id);
          addChatTurn(turn);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, setChatTurns, addChatTurn]);

  return { refetchChat };
}
