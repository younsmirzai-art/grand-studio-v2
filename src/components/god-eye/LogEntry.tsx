"use client";

import type { GodEyeEntry, GodEyeEventType } from "@/lib/agents/types";

const eventColors: Record<GodEyeEventType, string> = {
  thinking: "text-text-muted",
  api_call: "text-agent-amber",
  api_ok: "text-agent-green",
  fallback: "text-agent-rose",
  turn: "text-agent-teal",
  boss: "text-gold",
  execution: "text-agent-violet",
  screenshot: "text-agent-teal",
  error: "text-red-500",
  routing: "text-agent-teal",
};

const eventIcons: Record<GodEyeEventType, string> = {
  thinking: "◌",
  api_call: "→",
  api_ok: "✓",
  fallback: "⟲",
  turn: "◆",
  boss: "★",
  execution: "▶",
  screenshot: "📸",
  error: "✕",
  routing: "↗",
};

interface LogEntryProps {
  entry: GodEyeEntry;
}

export function LogEntry({ entry }: LogEntryProps) {
  const color = eventColors[entry.event_type] ?? "text-text-muted";
  const icon = eventIcons[entry.event_type] ?? "·";
  const time = new Date(entry.created_at).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex gap-2 py-0.5 hover:bg-boss-elevated/20 px-1 rounded">
      <span className="text-text-muted shrink-0">{time}</span>
      <span className={`shrink-0 w-4 text-center ${color}`}>{icon}</span>
      <span className={`shrink-0 uppercase text-[10px] tracking-wider w-16 ${color}`}>
        {entry.event_type}
      </span>
      {entry.agent_name && (
        <span className="text-text-secondary shrink-0">[{entry.agent_name}]</span>
      )}
      <span className="text-text-primary/80 truncate">{entry.detail}</span>
    </div>
  );
}
