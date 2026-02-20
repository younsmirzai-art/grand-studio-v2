"use client";

import { motion } from "framer-motion";
import { AgentAvatar } from "@/components/team/AgentAvatar";
import type { Task } from "@/lib/agents/types";

interface TaskCardProps {
  task: Task;
}

const statusColors: Record<string, string> = {
  pending: "border-boss-border",
  in_progress: "border-agent-amber/30",
  completed: "border-agent-green/30",
  rejected: "border-agent-rose/30",
  blocked: "border-text-muted",
};

export function TaskCard({ task }: TaskCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-boss-card border ${statusColors[task.status] ?? "border-boss-border"} rounded-lg p-3`}
    >
      <div className="flex items-start gap-2">
        <AgentAvatar name={task.assigned_to} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-primary truncate">
            {task.title}
          </p>
          <p className="text-[11px] text-text-muted truncate mt-0.5">
            {task.assigned_to}
          </p>
          {task.description && (
            <p className="text-[11px] text-text-muted line-clamp-2 mt-1">
              {task.description}
            </p>
          )}
        </div>
      </div>
      {task.depends_on && task.depends_on.length > 0 && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-[10px] text-text-muted">Depends on:</span>
          <span className="text-[10px] text-agent-teal">
            {task.depends_on.length} task(s)
          </span>
        </div>
      )}
    </motion.div>
  );
}
