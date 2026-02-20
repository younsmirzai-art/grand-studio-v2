"use client";

import { Database, Wifi, WifiOff, Activity } from "lucide-react";
import { useProjectStore } from "@/lib/stores/projectStore";

interface StatusBarProps {
  ue5Connected?: boolean;
}

export function StatusBar({ ue5Connected = false }: StatusBarProps) {
  const isAutonomous = useProjectStore((s) => s.isAutonomousRunning);
  const godEyeCount = useProjectStore((s) => s.godEyeLog.length);

  return (
    <footer className="h-7 border-t border-boss-border bg-boss-surface/50 flex items-center px-4 text-[11px] text-text-muted gap-4">
      <div className="flex items-center gap-1.5">
        <Database className="w-3 h-3 text-agent-green" />
        <span>Supabase</span>
      </div>

      <div className="flex items-center gap-1.5">
        {ue5Connected ? (
          <Wifi className="w-3 h-3 text-agent-green" />
        ) : (
          <WifiOff className="w-3 h-3 text-text-muted" />
        )}
        <span>UE5 {ue5Connected ? "Online" : "Offline"}</span>
      </div>

      {isAutonomous && (
        <div className="flex items-center gap-1.5 text-agent-green">
          <Activity className="w-3 h-3 animate-pulse" />
          <span>Autonomous</span>
        </div>
      )}

      <div className="ml-auto">
        <span>{godEyeCount} log entries</span>
      </div>
    </footer>
  );
}
