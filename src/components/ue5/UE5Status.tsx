"use client";

import { Wifi, WifiOff } from "lucide-react";

interface UE5StatusProps {
  connected: boolean;
}

export function UE5Status({ connected }: UE5StatusProps) {
  return (
    <div className="flex items-center gap-1.5">
      {connected ? (
        <>
          <Wifi className="w-3.5 h-3.5 text-agent-green" />
          <span className="text-xs text-agent-green">UE5 Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-xs text-text-muted">UE5 Offline</span>
        </>
      )}
    </div>
  );
}
