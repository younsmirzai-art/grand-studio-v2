"use client";

import { useEffect, useRef } from "react";
import { getClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/lib/stores/projectStore";
import type { GodEyeEntry } from "@/lib/types";

const POLL_INTERVAL_MS = 5000;

export function useRealtimeGodEye(projectId: string | null) {
  const { setGodEyeLog, addGodEyeEntry } = useProjectStore();
  const lastIdRef = useRef<number>(0);

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
        if (data) {
          setGodEyeLog(data as GodEyeEntry[]);
          const maxId = data.reduce((max, d) => Math.max(max, (d as GodEyeEntry).id), 0);
          lastIdRef.current = maxId;
        }
      });

    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("god_eye_log")
        .select("*")
        .eq("project_id", projectId)
        .gt("id", lastIdRef.current)
        .order("created_at", { ascending: true })
        .limit(50);

      if (data && data.length > 0) {
        for (const entry of data) {
          addGodEyeEntry(entry as GodEyeEntry);
        }
        const maxId = data.reduce((max, d) => Math.max(max, (d as GodEyeEntry).id), 0);
        lastIdRef.current = maxId;
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [projectId, setGodEyeLog, addGodEyeEntry]);
}
