"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useProjectStore } from "@/lib/stores/projectStore";
import { TaskCard } from "./TaskCard";
import type { TaskStatus } from "@/lib/agents/types";

const columns: { key: TaskStatus; label: string; color: string }[] = [
  { key: "pending", label: "Pending", color: "text-text-secondary" },
  { key: "in_progress", label: "In Progress", color: "text-agent-amber" },
  { key: "completed", label: "Completed", color: "text-agent-green" },
  { key: "rejected", label: "Rejected", color: "text-agent-rose" },
];

export function TaskBoard() {
  const tasks = useProjectStore((s) => s.tasks);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-80 border-l border-boss-border bg-boss-surface h-full overflow-y-auto scrollbar-thin"
    >
      <div className="p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Task Board</h3>
        <div className="space-y-6">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.key);
            return (
              <div key={col.key}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-medium ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="text-[10px] text-text-muted bg-boss-elevated px-1.5 py-0.5 rounded-full">
                    {colTasks.length}
                  </span>
                </div>
                <AnimatePresence>
                  {colTasks.length === 0 ? (
                    <p className="text-[11px] text-text-muted py-2">No tasks</p>
                  ) : (
                    <div className="space-y-2">
                      {colTasks.map((task) => (
                        <TaskCard key={task.id} task={task} />
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
