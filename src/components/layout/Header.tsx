"use client";

import { Crown, PanelLeftClose, PanelLeft, LayoutDashboard, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/lib/stores/uiStore";

interface HeaderProps {
  projectName: string;
}

export function Header({ projectName }: HeaderProps) {
  const { sidebarOpen, toggleSidebar, taskBoardVisible, setTaskBoardVisible } = useUIStore();

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
