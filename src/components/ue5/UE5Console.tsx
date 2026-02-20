"use client";

import { useState } from "react";
import {
  Play,
  Loader2,
  Terminal,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Clock,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "@/lib/stores/projectStore";
import { UE5_SERVER_CONFIG } from "@/lib/ue5/plugin-registry";
import { toast } from "sonner";

interface UE5ConsoleProps {
  projectId: string;
  isRelayConnected: boolean;
}

export function UE5Console({ projectId, isRelayConnected }: UE5ConsoleProps) {
  const [code, setCode] = useState("");
  const [executing, setExecuting] = useState(false);
  const [expandedCmd, setExpandedCmd] = useState<string | null>(null);
  const ue5Commands = useProjectStore((s) => s.ue5Commands);

  const recentCommands = ue5Commands.slice(0, 10);

  const handleExecute = async () => {
    if (!code.trim() || executing) return;

    if (!code.includes("import unreal")) {
      toast.error('Code must include "import unreal"');
      return;
    }

    setExecuting(true);

    try {
      const res = await fetch("/api/ue5/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          code: code.trim(),
          agentName: "Boss",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Code queued for UE5 execution");
        setCode("");
      } else {
        toast.error(data.error ?? "Failed to queue code");
      }
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="bg-boss-card border border-boss-border rounded-xl overflow-hidden">
      {/* Header with connection status */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-boss-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-agent-green" />
          <span className="text-sm font-medium text-text-primary">UE5 Console</span>
        </div>
        <div className="flex items-center gap-3">
          {isRelayConnected ? (
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-agent-green" />
              <span className="text-[11px] text-agent-green">Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <WifiOff className="w-3 h-3 text-text-muted" />
              <span className="text-[11px] text-text-muted">Disconnected</span>
            </div>
          )}
        </div>
      </div>

      {/* Server info */}
      <div className="px-4 py-1.5 border-b border-boss-border bg-boss-surface/50 flex items-center gap-4">
        <Server className="w-3 h-3 text-text-muted shrink-0" />
        <div className="flex items-center gap-3 text-[10px] font-mono text-text-muted overflow-x-auto">
          <span>HTTP <span className="text-agent-teal">30010</span></span>
          <span className="text-boss-border">|</span>
          <span>WS <span className="text-agent-teal">30020</span></span>
          <span className="text-boss-border">|</span>
          <span>Web <span className="text-agent-teal">30000</span></span>
        </div>
      </div>

      {/* Code input */}
      <div className="p-3">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={"import unreal\n\n# Enter UE5 Python code here...\n# Code is sent to localhost:30010 via relay"}
          rows={6}
          className="w-full bg-boss-bg border border-boss-border rounded-lg p-3 font-mono text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-agent-green/40"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-text-muted">
            PUT {UE5_SERVER_CONFIG.httpUrl}/remote/object/call
          </span>
          <Button
            size="sm"
            onClick={handleExecute}
            disabled={!code.trim() || executing}
            className="bg-agent-green/10 hover:bg-agent-green/20 text-agent-green border border-agent-green/20 gap-1.5"
          >
            {executing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Send to UE5
          </Button>
        </div>
      </div>

      {/* Command history */}
      {recentCommands.length > 0 && (
        <div className="border-t border-boss-border px-4 py-2">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
            Command History
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
            {recentCommands.map((cmd) => (
              <div key={cmd.id} className="rounded-lg overflow-hidden">
                <button
                  onClick={() =>
                    setExpandedCmd(expandedCmd === cmd.id ? null : cmd.id)
                  }
                  className="w-full flex items-center gap-2 text-xs py-1.5 px-2 hover:bg-boss-elevated/30 rounded transition-colors"
                >
                  <CommandStatusIcon status={cmd.status} />
                  <span className="font-mono text-text-secondary truncate flex-1 text-left">
                    {cmd.code.split("\n").find((l) => l.trim() && !l.startsWith("import")) ?? cmd.code.slice(0, 60)}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] h-4 px-1 border shrink-0 ${statusBadgeClass(cmd.status)}`}
                  >
                    {cmd.status}
                  </Badge>
                  {expandedCmd === cmd.id ? (
                    <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
                  )}
                </button>
                {expandedCmd === cmd.id && (
                  <div className="mx-2 mb-2 p-2 bg-boss-bg rounded border border-boss-border">
                    <pre className="text-[11px] font-mono text-text-secondary whitespace-pre-wrap max-h-32 overflow-y-auto scrollbar-thin">
                      {cmd.code}
                    </pre>
                    {cmd.result && (
                      <div className="mt-2 pt-2 border-t border-boss-border">
                        <p className="text-[10px] text-agent-green mb-1">Result:</p>
                        <pre className="text-[11px] font-mono text-text-secondary whitespace-pre-wrap">
                          {cmd.result}
                        </pre>
                      </div>
                    )}
                    {cmd.error_log && (
                      <div className="mt-2 pt-2 border-t border-boss-border">
                        <p className="text-[10px] text-agent-rose mb-1">Error:</p>
                        <pre className="text-[11px] font-mono text-agent-rose/80 whitespace-pre-wrap">
                          {cmd.error_log}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CommandStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Clock className="w-3 h-3 text-agent-amber shrink-0" />;
    case "executing":
      return <Loader2 className="w-3 h-3 text-agent-teal animate-spin shrink-0" />;
    case "success":
      return <Check className="w-3 h-3 text-agent-green shrink-0" />;
    case "error":
      return <X className="w-3 h-3 text-agent-rose shrink-0" />;
    default:
      return <Clock className="w-3 h-3 text-text-muted shrink-0" />;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-agent-amber/10 text-agent-amber border-agent-amber/20";
    case "executing":
      return "bg-agent-teal/10 text-agent-teal border-agent-teal/20";
    case "success":
      return "bg-agent-green/10 text-agent-green border-agent-green/20";
    case "error":
      return "bg-agent-rose/10 text-agent-rose border-agent-rose/20";
    default:
      return "bg-boss-elevated text-text-muted border-boss-border";
  }
}
