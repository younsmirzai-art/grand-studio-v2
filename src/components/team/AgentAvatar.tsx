"use client";

import { getAgent } from "@/lib/agents/identity";
import type { AgentName } from "@/lib/agents/types";

interface AgentAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  showStatus?: boolean;
  status?: "idle" | "thinking" | "consulting" | "responding" | "error";
}

const sizeClasses = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
};

export function AgentAvatar({ name, size = "md", showStatus, status }: AgentAvatarProps) {
  const agent = getAgent(name);
  const isBoss = name === "Boss" || name === "ریس";

  const bgColor = isBoss
    ? "bg-gold/15 border-gold/30"
    : agent
      ? `border-current opacity-90`
      : "bg-boss-elevated border-boss-border";

  const statusColor =
    status === "thinking"
      ? "bg-agent-amber animate-pulse"
      : status === "consulting"
        ? "bg-agent-teal animate-pulse"
        : status === "responding"
          ? "bg-agent-green animate-pulse"
          : status === "error"
            ? "bg-agent-rose"
            : "bg-agent-green";

  return (
    <div className="relative">
      <div
        className={`${sizeClasses[size]} rounded-lg border flex items-center justify-center shrink-0 ${bgColor}`}
        style={
          agent && !isBoss
            ? { borderColor: agent.colorHex + "40", backgroundColor: agent.colorHex + "15" }
            : undefined
        }
      >
        {isBoss ? "👑" : agent?.icon ?? name[0]}
      </div>
      {showStatus && status && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-boss-card ${statusColor}`}
        />
      )}
    </div>
  );
}

export function AgentNameBadge({ name }: { name: string }) {
  const agent = getAgent(name as AgentName);
  const isBoss = name === "Boss" || name === "ریس";

  return (
    <span
      className={`font-semibold text-sm ${isBoss ? "text-gold" : ""}`}
      style={agent && !isBoss ? { color: agent.colorHex } : undefined}
    >
      {isBoss ? "ریس (Boss)" : name}
    </span>
  );
}
