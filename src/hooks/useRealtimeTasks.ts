"use client";

import { useEffect, useRef } from "react";
import { getClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/lib/stores/projectStore";
import type { Task } from "@/lib/types";

const POLL_INTERVAL_MS = 5000;

export function useRealtimeTasks(projectId: string | null) {
  const { setTasks } = useProjectStore();
  const hashRef = useRef<string>("");

  useEffect(() => {
    if (!projectId) return;

    const supabase = getClient();

    const fetchTasks = async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true });

      if (data) {
        const hash = JSON.stringify(data.map((t) => `${(t as Task).id}:${(t as Task).status}`));
        if (hash !== hashRef.current) {
          hashRef.current = hash;
          setTasks(data as Task[]);
        }
      }
    };

    fetchTasks();
    const timer = setInterval(fetchTasks, POLL_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [projectId, setTasks]);
}
