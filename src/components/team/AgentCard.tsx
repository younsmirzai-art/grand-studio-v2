"use client";

import { AgentAvatar } from "./AgentAvatar";
import type { AgentIdentity, AgentStatus } from "@/lib/agents/types";

interface AgentCardProps {
  agent: AgentIdentity;
  status: AgentStatus;
}

export function AgentCard({ agent, status }: AgentCardProps) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-boss-elevated/50 transition-colors">
      <AgentAvatar
        name={agent.name}
        size="sm"
        showStatus
        status={status.state}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className="text-sm font-medium"
            style={{ color: agent.colorHex }}
          >
            {agent.name}
          </span>
        </div>
        <p className="text-[11px] text-text-muted truncate">{agent.title}</p>
      </div>
      <StatusDot state={status.state} />
    </div>
  );
}

function StatusDot({ state }: { state: AgentStatus["state"] }) {
  const config: Record<AgentStatus["state"], { color: string; label: string }> = {
    idle: { color: "bg-text-muted", label: "Idle" },
    thinking: { color: "bg-agent-amber animate-pulse", label: "Thinking..." },
    consulting: { color: "bg-agent-teal animate-pulse", label: "Consulting..." },
    responding: { color: "bg-agent-green animate-pulse", label: "Responding..." },
    error: { color: "bg-agent-rose", label: "Error" },
  };
  const c = config[state];
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-text-muted">{c.label}</span>
      <div className={`w-1.5 h-1.5 rounded-full ${c.color}`} />
    </div>
  );
}
