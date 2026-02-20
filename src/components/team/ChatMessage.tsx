"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import { Play, Copy, Check } from "lucide-react";
import { AgentAvatar, AgentNameBadge } from "./AgentAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChatTurn, TurnType } from "@/lib/agents/types";
import { getAgent } from "@/lib/agents/identity";

interface ChatMessageProps {
  turn: ChatTurn;
  onExecuteCode?: (code: string) => void;
}

const turnTypeConfig: Record<TurnType, { label: string; className: string }> = {
  proposal: { label: "Proposal", className: "bg-agent-green/10 text-agent-green border-agent-green/20" },
  critique: { label: "Critique", className: "bg-agent-amber/10 text-agent-amber border-agent-amber/20" },
  resolution: { label: "Resolution", className: "bg-agent-violet/10 text-agent-violet border-agent-violet/20" },
  discussion: { label: "Discussion", className: "bg-boss-elevated text-text-secondary border-boss-border" },
  consultation: { label: "\u{1F91D} Consultation", className: "bg-agent-teal/10 text-agent-teal border-agent-teal/20" },
  routing: { label: "Routing", className: "bg-agent-teal/10 text-agent-teal border-agent-teal/20" },
  execution: { label: "Execution", className: "bg-agent-green/10 text-agent-green border-agent-green/20" },
  boss_command: { label: "Boss Order", className: "bg-gold/10 text-gold border-gold/20" },
  direct: { label: "Direct Reply", className: "bg-agent-violet/10 text-agent-violet border-agent-violet/20" },
  direct_command: { label: "DM", className: "bg-gold/10 text-gold border-gold/20" },
};

function parseCodeBlocks(text: string): { type: "text" | "code"; content: string; lang?: string }[] {
  const parts: { type: "text" | "code"; content: string; lang?: string }[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", content: match[2], lang: match[1] || "text" });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts;
}

function renderTextContent(text: string): React.ReactNode {
  return text.split("\n").map((line, i) => {
    const processed = line.split(/(\*\*.*?\*\*)/).map((segment, j) => {
      if (segment.startsWith("**") && segment.endsWith("**")) {
        return <strong key={j} className="font-semibold text-text-primary">{segment.slice(2, -2)}</strong>;
      }
      return segment;
    });

    return (
      <span key={i}>
        {i > 0 && <br />}
        {processed}
      </span>
    );
  });
}

function ChatMessageInner({ turn, onExecuteCode }: ChatMessageProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const isBoss = turn.turn_type === "boss_command" || turn.turn_type === "direct_command";
  const isDirect = turn.turn_type === "direct" || turn.turn_type === "direct_command";
  const isConsultation = turn.turn_type === "consultation";
  const agent = getAgent(turn.agent_name);
  const typeConfig = turnTypeConfig[turn.turn_type] ?? turnTypeConfig.discussion;

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const parts = parseCodeBlocks(turn.content || "");

  const bgClass = isBoss
    ? "bg-gold/[0.03] border-l-2 border-gold/30"
    : isDirect
      ? "bg-agent-violet/[0.03] border-l-2 border-agent-violet/30"
      : isConsultation
        ? "bg-agent-teal/[0.03] border-l-2 border-agent-teal/20"
        : "hover:bg-boss-surface/50";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`group px-4 py-3 ${bgClass}`}
    >
      <div className="flex gap-3">
        <AgentAvatar name={isBoss ? "Boss" : turn.agent_name} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <AgentNameBadge name={isBoss ? "Boss" : turn.agent_name} />
            {agent && !isBoss && (
              <span className="text-text-muted text-xs">{agent.title}</span>
            )}
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 border ${typeConfig.className}`}
            >
              {typeConfig.label}
            </Badge>
            {isDirect && !isBoss && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border bg-agent-violet/10 text-agent-violet border-agent-violet/20">
                DM to Boss
              </Badge>
            )}
            <span className="text-text-muted text-[11px] ml-auto">
              {new Date(turn.created_at).toLocaleTimeString()}
            </span>
          </div>

          <div className="text-sm text-text-primary/90 leading-relaxed">
            {parts.map((part, i) => {
              if (part.type === "code") {
                const isPython = part.lang === "python";
                return (
                  <div key={i} className="relative my-2 rounded-lg overflow-hidden border border-boss-border">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-boss-elevated/50 border-b border-boss-border">
                      <span className="text-[11px] text-text-muted font-mono">{part.lang}</span>
                      <div className="flex items-center gap-1">
                        {isPython && onExecuteCode && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onExecuteCode(part.content.trim())}
                            className="h-6 px-2 text-[11px] text-agent-green hover:text-agent-green hover:bg-agent-green/10 gap-1"
                          >
                            <Play className="w-3 h-3" />
                            Execute in UE5
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(part.content.trim())}
                          className="h-6 px-2 text-text-muted hover:text-text-primary"
                        >
                          {copiedCode === part.content.trim() ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <pre className="p-3 bg-[#0b0d12] overflow-x-auto text-[13px] font-mono text-agent-green/80">
                      <code>{part.content}</code>
                    </pre>
                  </div>
                );
              }

              return (
                <div key={i} className="whitespace-pre-wrap">
                  {renderTextContent(part.content.trim())}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export const ChatMessage = memo(ChatMessageInner);
