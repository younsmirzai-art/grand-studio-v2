"use client";

import { useState } from "react";
import { Play, Loader2, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/lib/stores/projectStore";

interface UE5ConsoleProps {
  projectId: string;
}

export function UE5Console({ projectId }: UE5ConsoleProps) {
  const [code, setCode] = useState("");
  const [executing, setExecuting] = useState(false);
  const ue5Commands = useProjectStore((s) => s.ue5Commands);

  const recentCommands = ue5Commands.slice(0, 5);

  const handleExecute = async () => {
    if (!code.trim() || executing) return;
    setExecuting(true);

    try {
      const supabase = getClient();
      await supabase.from("ue5_commands").insert({
        project_id: projectId,
        code: code.trim(),
        status: "pending",
      });
      setCode("");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="bg-boss-card border border-boss-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-boss-border">
        <Terminal className="w-4 h-4 text-agent-green" />
        <span className="text-sm font-medium text-text-primary">UE5 Console</span>
      </div>

      <div className="p-3">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="# Enter UE5 Python code here..."
          rows={6}
          className="w-full bg-boss-bg border border-boss-border rounded-lg p-3 font-mono text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-agent-green/40"
        />
        <div className="flex justify-end mt-2">
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
            Execute
          </Button>
        </div>
      </div>

      {recentCommands.length > 0 && (
        <div className="border-t border-boss-border px-4 py-2">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
            Recent Commands
          </p>
          <div className="space-y-1.5">
            {recentCommands.map((cmd) => (
              <div
                key={cmd.id}
                className="flex items-center gap-2 text-xs"
              >
                <StatusDot status={cmd.status} />
                <span className="font-mono text-text-secondary truncate flex-1">
                  {cmd.code.slice(0, 60)}...
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-agent-amber",
    executing: "bg-agent-teal animate-pulse",
    success: "bg-agent-green",
    error: "bg-agent-rose",
  };
  return <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors[status] ?? "bg-text-muted"}`} />;
}
