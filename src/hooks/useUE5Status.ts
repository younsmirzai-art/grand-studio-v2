"use client";

import { useEffect, useCallback, useRef } from "react";
import { getClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/lib/stores/projectStore";
import type { UE5Command } from "@/lib/types";

export function useUE5Status(projectId: string | null) {
  const { setUE5Commands, addUE5Command, updateUE5Command, setRelayConnected } =
    useProjectStore();
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollHeartbeat = useCallback(async () => {
    try {
      const supabase = getClient();
      const { data } = await supabase
        .from("relay_heartbeat")
        .select("last_ping, ue5_connected")
        .order("last_ping", { ascending: false })
        .limit(1);

      const row = data?.[0] as { last_ping?: string; ue5_connected?: boolean } | undefined;
      if (row?.last_ping) {
        const age = Date.now() - new Date(row.last_ping).getTime();
        setRelayConnected(age < 60_000 && row.ue5_connected === true);
      } else {
        setRelayConnected(false);
      }
    } catch {
      setRelayConnected(false);
    }
  }, [setRelayConnected]);

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
          setUE5Commands(data as UE5Command[]);
        }
      });

    // Poll relay_heartbeat every 10 seconds for connection status
    pollHeartbeat();
    heartbeatTimer.current = setInterval(pollHeartbeat, 10_000);

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
            pollHeartbeat();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    };
  }, [projectId, setUE5Commands, addUE5Command, updateUE5Command, setRelayConnected, pollHeartbeat]);
}
