"use client";

import { useEffect } from "react";
import { getClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/lib/stores/projectStore";
import type { Task } from "@/lib/agents/types";

export function useRealtimeTasks(projectId: string | null) {
  const { setTasks, addTask, updateTask } = useProjectStore();

  useEffect(() => {
    if (!projectId) return;

    const supabase = getClient();

    supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("order_index", { ascending: true })
      .then(({ data }) => {
        if (data) setTasks(data as Task[]);
      });

    const channel = supabase
      .channel(`tasks:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          addTask(payload.new as Task);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const updated = payload.new as Task;
          updateTask(updated.id, updated);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, setTasks, addTask, updateTask]);
}
