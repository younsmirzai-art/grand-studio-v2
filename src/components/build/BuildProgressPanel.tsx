"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export interface BuildTask {
  id: string;
  title: string;
  assignedTo?: string;
  status: "pending" | "in_progress" | "running" | "completed" | "error" | "skipped" | "failed";
  startedAt?: number;
  completedAt?: number;
  code?: string;
  result?: string;
  errorLog?: string;
}

interface BuildProgressPanelProps {
  projectId: string;
  tasks: BuildTask[];
  isBuilding: boolean;
  currentCode?: string;
  currentTaskTitle?: string | null;
  onPause: () => void;
  onStop: () => void;
  onFeedback: (msg: string) => void;
}

function taskIcon(status: BuildTask["status"]) {
  switch (status) {
    case "completed":
      return "✅";
    case "running":
    case "in_progress":
      return "🔄";
    case "pending":
      return "⏳";
    case "error":
    case "failed":
      return "❌";
    case "skipped":
      return "⏭️";
    default:
      return "⏳";
  }
}

function taskTime(task: BuildTask): string | null {
  if (task.completedAt != null && task.startedAt != null && task.completedAt > task.startedAt) {
    return `${((task.completedAt - task.startedAt) / 1000).toFixed(1)}s`;
  }
  return null;
}

export default function BuildProgressPanel({
  projectId,
  tasks,
  isBuilding,
  currentCode = "",
  currentTaskTitle,
  onPause,
  onStop,
  onFeedback,
}: BuildProgressPanelProps) {
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const currentTask = tasks.find((t) => t.status === "running" || t.status === "in_progress");
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isBuilding) return;
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isBuilding]);

  const avgTaskTime = completedCount > 0 ? elapsed / completedCount : 15;
  const remainingTasks = totalTasks - completedCount;
  const estimatedRemaining = Math.round(remainingTasks * avgTaskTime);

  return (
    <div className="flex flex-col h-full bg-boss-surface border-b border-boss-border overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-boss-border">
        <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
          🏗️ Building your game...
        </h2>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-boss-elevated overflow-hidden">
            <motion.div
              className="h-full bg-gold rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-xs font-medium text-text-muted shrink-0">
            {progress}% — Task {completedCount}/{totalTasks}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-4 py-2 space-y-1">
          {tasks.map((task, i) => (
            <div
              key={task.id}
              className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm ${
                task.status === "running" || task.status === "in_progress"
                  ? "bg-gold/10 border border-gold/20"
                  : "border border-transparent"
              }`}
            >
              <span className="shrink-0 w-5 text-center">{taskIcon(task.status)}</span>
              <span className="flex-1 min-w-0 text-text-primary truncate">
                Task {i + 1}/{totalTasks}: {task.title}
              </span>
              {task.assignedTo && (
                <span className="text-xs text-text-muted shrink-0">({task.assignedTo})</span>
              )}
              {taskTime(task) && (
                <span className="text-xs text-text-muted shrink-0">{taskTime(task)}</span>
              )}
            </div>
          ))}
        </div>

        {(currentTask || currentCode) && (
          <div className="px-4 pb-3">
            <div className="rounded-lg border border-boss-border bg-boss-card/80 overflow-hidden">
              <div className="px-3 py-1.5 border-b border-boss-border text-xs font-medium text-text-muted">
                💻 {currentTask?.assignedTo ?? "Thomas"} is writing code...
                {currentTaskTitle && ` — ${currentTaskTitle}`}
              </div>
              <pre className="p-3 text-xs text-text-secondary font-mono overflow-x-auto overflow-y-auto max-h-32 whitespace-pre-wrap break-words">
                <code>{currentCode || "Waiting for code..."}</code>
                {currentCode && <span className="inline-block w-2 h-4 ml-0.5 bg-gold animate-pulse align-middle" />}
              </pre>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 py-2 border-t border-boss-border flex items-center justify-between gap-2 text-xs text-text-muted">
        <span>⏱️ {elapsed}s elapsed</span>
        {remainingTasks > 0 && isBuilding && (
          <span>~{estimatedRemaining}s remaining</span>
        )}
      </div>

      <div className="shrink-0 px-4 py-2 flex gap-2 border-t border-boss-border">
        <Button
          size="sm"
          variant="outline"
          onClick={onPause}
          disabled={!isBuilding}
          className="border-agent-amber/30 text-agent-amber hover:bg-agent-amber/10 gap-1.5 flex-1"
        >
          ⏸️ Pause
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onStop}
          disabled={!isBuilding}
          className="border-agent-rose/30 text-agent-rose hover:bg-agent-rose/10 gap-1.5 flex-1"
        >
          ⏹️ Stop
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onFeedback("")}
          className="border-boss-border text-text-secondary hover:text-text-primary gap-1.5 flex-1"
        >
          💬 Feedback
        </Button>
      </div>
    </div>
  );
}
