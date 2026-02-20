"use client";

import { useProjectStore } from "@/lib/stores/projectStore";
import { AgentAvatar } from "@/components/team/AgentAvatar";
import { Check, Clock, AlertCircle, Loader2, Ban } from "lucide-react";

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3 text-text-muted" />,
  in_progress: <Loader2 className="w-3 h-3 text-agent-amber animate-spin" />,
  completed: <Check className="w-3 h-3 text-agent-green" />,
  rejected: <AlertCircle className="w-3 h-3 text-agent-rose" />,
  blocked: <Ban className="w-3 h-3 text-text-muted" />,
};

export function TaskTimeline() {
  const tasks = useProjectStore((s) => s.tasks);

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No tasks created yet
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-boss-border" />
      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="relative flex items-start gap-3 pl-8">
            <div className="absolute left-[11px] top-2 w-2.5 h-2.5 rounded-full bg-boss-card border border-boss-border flex items-center justify-center">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  task.status === "completed"
                    ? "bg-agent-green"
                    : task.status === "in_progress"
                      ? "bg-agent-amber animate-pulse"
                      : task.status === "rejected"
                        ? "bg-agent-rose"
                        : "bg-text-muted"
                }`}
              />
            </div>
            <div className="flex-1 bg-boss-card border border-boss-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                {statusIcons[task.status]}
                <span className="text-xs font-medium text-text-primary">
                  {task.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AgentAvatar name={task.assigned_to} size="sm" />
                <span className="text-[11px] text-text-muted">
                  {task.assigned_to}
                </span>
              </div>
              {task.description && (
                <p className="text-[11px] text-text-muted mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
