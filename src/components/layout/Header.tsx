"use client";

import { Crown, PanelLeftClose, PanelLeft, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/lib/stores/uiStore";
import type { PresenceUser } from "@/lib/collaboration/presence";
import type { UE5Command } from "@/lib/agents/types";

interface HeaderProps {
  projectName: string;
  onlineUsers?: PresenceUser[];
  executingCommand?: UE5Command | null;
}

export function Header({ projectName, onlineUsers = [], executingCommand }: HeaderProps) {
  const { sidebarOpen, toggleSidebar, taskBoardVisible, setTaskBoardVisible } = useUIStore();
  const displayUsers = onlineUsers.slice(0, 5);
  const moreCount = onlineUsers.length > 5 ? onlineUsers.length - 5 : 0;

  return (
    <header className="h-12 border-b border-boss-border bg-boss-surface/80 glass-strong flex items-center px-4 gap-3 sticky top-0 z-40">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="text-text-muted hover:text-text-primary h-8 w-8 p-0"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeft className="w-4 h-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{sidebarOpen ? "Hide sidebar" : "Show sidebar"}</TooltipContent>
      </Tooltip>

      <div className="flex items-center gap-2">
        <Crown className="w-4 h-4 text-gold" />
        <h2 className="text-sm font-semibold text-text-primary">{projectName}</h2>
      </div>

      {onlineUsers.length > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-2">
            {displayUsers.map((u) => (
              <Tooltip key={u.user_email}>
                <TooltipTrigger asChild>
                  <div
                    className="w-7 h-7 rounded-full bg-boss-elevated border-2 border-boss-surface flex items-center justify-center text-xs font-medium text-text-primary"
                    title={u.user_name || u.user_email}
                  >
                    {(u.user_name || u.user_email).slice(0, 1).toUpperCase()}
                  </div>
                </TooltipTrigger>
                <TooltipContent>{u.user_name || u.user_email}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <span className="text-[11px] text-text-muted">
            {onlineUsers.length} online
          </span>
          {moreCount > 0 && (
            <span className="text-[11px] text-text-muted">+{moreCount} more</span>
          )}
        </div>
      )}

      {executingCommand?.submitted_by_name && (
        <span className="text-xs text-amber-500 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Waiting… {executingCommand.submitted_by_name}&apos;s command is executing
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={taskBoardVisible ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTaskBoardVisible(!taskBoardVisible)}
              className="h-8 gap-1.5 text-text-secondary"
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span className="text-xs">Tasks</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle task board</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
