"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Play, Copy, Check } from "lucide-react";
import { useState } from "react";
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
  consultation: { label: "Review", className: "bg-agent-rose/10 text-agent-rose border-agent-rose/20" },
  routing: { label: "Routing", className: "bg-agent-teal/10 text-agent-teal border-agent-teal/20" },
  execution: { label: "Execution", className: "bg-agent-green/10 text-agent-green border-agent-green/20" },
  boss_command: { label: "Boss Order", className: "bg-gold/10 text-gold border-gold/20" },
};

function ChatMessageInner({ turn, onExecuteCode }: ChatMessageProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const isBoss = turn.turn_type === "boss_command";
  const agent = getAgent(turn.agent_name);
  const typeConfig = turnTypeConfig[turn.turn_type] ?? turnTypeConfig.discussion;

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`group px-4 py-3 ${isBoss ? "bg-gold/[0.03] border-l-2 border-gold/30" : "hover:bg-boss-surface/50"}`}
    >
      <div className="flex gap-3">
        <AgentAvatar name={isBoss ? "Boss" : turn.agent_name} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
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
            <span className="text-text-muted text-[11px] ml-auto">
              {new Date(turn.created_at).toLocaleTimeString()}
            </span>
          </div>

          <div className="prose prose-invert prose-sm max-w-none text-text-primary/90 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:text-text-primary/90">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeStr = String(children).replace(/\n$/, "");

                  if (match) {
                    const lang = match[1];
                    const isPython = lang === "python";

                    return (
                      <div className="relative group/code my-2 rounded-lg overflow-hidden border border-boss-border">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-boss-elevated/50 border-b border-boss-border">
                          <span className="text-[11px] text-text-muted font-mono">{lang}</span>
                          <div className="flex items-center gap-1">
                            {isPython && onExecuteCode && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onExecuteCode(codeStr)}
                                className="h-6 px-2 text-[11px] text-agent-green hover:text-agent-green hover:bg-agent-green/10 gap-1"
                              >
                                <Play className="w-3 h-3" />
                                Execute in UE5
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopy(codeStr)}
                              className="h-6 px-2 text-text-muted hover:text-text-primary"
                            >
                              {copiedCode === codeStr ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <SyntaxHighlighter
                          style={oneDark}
                          language={lang}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            background: "#0b0d12",
                            padding: "12px",
                            fontSize: "13px",
                          }}
                        >
                          {codeStr}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }

                  return (
                    <code
                      className="bg-boss-elevated px-1.5 py-0.5 rounded text-[13px] font-mono text-agent-teal"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export const ChatMessage = memo(ChatMessageInner);
