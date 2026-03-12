"use client";

import { ChevronLeft, Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/lib/stores/projectStore";
import type { UE5Command } from "@/lib/types";

interface HeaderProps {
  projectName: string;
  executingCommand?: UE5Command | null;
}

export function Header({ projectName, executingCommand }: HeaderProps) {
  const params = useParams();
  const projectId = params.id as string;
  const { isRelayConnected, isFullProjectRunning } = useProjectStore();

  const status: { label: string; color: string } = executingCommand
    ? { label: "Executing…", color: "bg-amber-500" }
    : isFullProjectRunning
      ? { label: "Generating…", color: "bg-[#2196F3]" }
      : { label: "Idle", color: "bg-[#606068]" };

  return (
    <header className="h-12 border-b border-white/5 bg-[#111114] flex items-center px-4 gap-3 sticky top-0 z-40">
      {/* Left: back + project name */}
      <Link
        href="/dashboard"
        className="flex items-center gap-1 text-[#606068] hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </Link>
      <h2 className="text-sm font-semibold text-white truncate">{projectName}</h2>

      {/* Center: build status */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-[#808088]">
          <span className={`w-2 h-2 rounded-full ${status.color} ${status.label !== "Idle" ? "animate-pulse" : ""}`} />
          {status.label}
        </div>
      </div>

      {/* Right: UE5 status + settings */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`w-2 h-2 rounded-full ${isRelayConnected ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className={isRelayConnected ? "text-emerald-400" : "text-red-400"}>
            {isRelayConnected ? "UE5 Connected" : "UE5 Disconnected"}
          </span>
        </div>
        <Link
          href={`/project/${projectId}/settings`}
          className="text-[#606068] hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}
