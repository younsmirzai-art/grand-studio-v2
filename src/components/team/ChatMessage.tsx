"use client";

import { memo, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Copy, Check, Rocket } from "lucide-react";
import { AgentAvatar, AgentNameBadge } from "./AgentAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScreenshotPreview } from "@/components/chat/ScreenshotPreview";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { ChatTurn, TurnType } from "@/lib/agents/types";
import { getAgent } from "@/lib/agents/identity";
import { parseMusicBlock } from "@/lib/music/musicEngine";
import { MusicPlayer } from "@/components/tools/MusicPlayer";
import { parseTrailerTag } from "@/lib/trailer/trailerEngine";
import { TrailerPreviewCard } from "@/components/tools/TrailerPreviewCard";
import type { TrailerTemplateKey } from "@/lib/trailer/trailerEngine";

interface ChatMessageProps {
  turn: ChatTurn;
  onExecuteCode?: (code: string, agentName?: string) => void | Promise<void>;
  onRecreateImage?: (imageUrl: string) => void | Promise<void>;
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

function ChatMessageInner({ turn, onExecuteCode, onRecreateImage }: ChatMessageProps) {
  const params = useParams();
  const projectId = params?.id as string | undefined;
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [ue5Confirm, setUe5Confirm] = useState<{ code: string; index: number } | null>(null);
  const [ue5Sending, setUe5Sending] = useState(false);
  const [ue5SentBlocks, setUe5SentBlocks] = useState<Set<number>>(new Set());
  const [recreateLoading, setRecreateLoading] = useState(false);
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

  const handleConfirmSendToUE5 = async () => {
    if (!onExecuteCode || !ue5Confirm) return;
    setUe5Sending(true);
    try {
      await onExecuteCode(ue5Confirm.code.trim(), turn.agent_name);
      setUe5SentBlocks((prev) => new Set([...prev, ue5Confirm.index]));
      setUe5Confirm(null);
      toast.success("Code queued for UE5 execution");
    } catch {
      toast.error("Failed to send code to UE5");
    } finally {
      setUe5Sending(false);
    }
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

          <div className="text-sm text-text-primary/90 leading-relaxed space-y-2">
            {turn.screenshot_url && (
              <ScreenshotPreview
                url={turn.screenshot_url}
                timestamp={turn.created_at}
                success={turn.turn_type === "execution"}
                projectId={projectId}
              />
            )}
            {turn.attachment_url && isBoss && (
              <div className="space-y-2">
                <img src={turn.attachment_url} alt="Attached" className="max-w-xs rounded-lg border border-boss-border object-cover" />
                {onRecreateImage && (
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted text-xs">Want to recreate this image in UE5?</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-agent-teal/50 text-agent-teal hover:bg-agent-teal/10"
                      onClick={async () => {
                        setRecreateLoading(true);
                        try {
                          await onRecreateImage(turn.attachment_url!);
                        } finally {
                          setRecreateLoading(false);
                        }
                      }}
                      disabled={recreateLoading}
                    >
                      {recreateLoading ? "Building…" : "Yes, build it"}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {parts.map((part, i) => {
              if (part.type === "code") {
                const prevContent = i > 0 && parts[i - 1].type === "text" ? parts[i - 1].content : "";
                const musicBlock =
                  (part.lang === "javascript" || part.lang === "js") && parseMusicBlock(prevContent + "\n```javascript\n" + part.content + "\n```");
                if (musicBlock && projectId) {
                  return (
                    <div key={i} className="my-3">
                      <MusicPlayer
                        title={musicBlock.title}
                        description={musicBlock.description}
                        code={musicBlock.code}
                        projectId={projectId}
                      />
                    </div>
                  );
                }
                const isPython = part.lang === "python";
                const sent = ue5SentBlocks.has(i);
                const canSendToUE5 = isPython && onExecuteCode && projectId;
                return (
                  <div key={i} className="relative my-2 rounded-lg overflow-hidden border border-boss-border">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-boss-elevated/50 border-b border-boss-border">
                      <span className="text-[11px] text-text-muted font-mono">{part.lang}</span>
                      <div className="flex items-center gap-1">
                        {canSendToUE5 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setUe5Confirm({ code: part.content.trim(), index: i })}
                            disabled={sent}
                            className={`h-6 px-2 text-[11px] gap-1 ${
                              sent
                                ? "text-agent-green/70 cursor-default"
                                : "text-agent-green hover:text-agent-green hover:bg-agent-green/15 border border-agent-green/30 animate-pulse"
                            }`}
                          >
                            <Rocket className="w-3 h-3" />
                            {sent ? "✅ Sent to UE5!" : "🚀 Send to UE5"}
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

              if (part.type === "text") {
                const trailerMatch = parseTrailerTag(part.content);
                if (trailerMatch && projectId && onExecuteCode) {
                  return (
                    <div key={i} className="space-y-2">
                      <div className="whitespace-pre-wrap">
                        {renderTextContent(part.content.replace(/\[TRAILER\s+[\w]+\s*(?:\:[^\]]*)?\]/gi, "").trim())}
                      </div>
                      <TrailerPreviewCard
                        templateKey={trailerMatch.templateKey as TrailerTemplateKey}
                        description={trailerMatch.description}
                        projectId={projectId}
                        onExecuteCode={onExecuteCode}
                      />
                    </div>
                  );
                }
                return (
                  <div key={i} className="whitespace-pre-wrap">
                    {renderTextContent(part.content.trim())}
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      </div>

      <Dialog open={ue5Confirm !== null} onOpenChange={(open) => !open && setUe5Confirm(null)}>
        <DialogContent className="bg-boss-surface border-boss-border">
          <DialogHeader>
            <DialogTitle className="text-text-primary">Send to Unreal Engine 5?</DialogTitle>
            <DialogDescription className="text-text-muted">
              This code will be queued for execution on your local UE5 instance. The relay must be running.
            </DialogDescription>
          </DialogHeader>
          {ue5Confirm && (
            <pre className="max-h-32 overflow-auto rounded bg-boss-elevated p-3 text-xs font-mono text-agent-green/90 border border-boss-border">
              {ue5Confirm.code.split("\n").slice(0, 5).join("\n")}
              {ue5Confirm.code.split("\n").length > 5 && "\n..."}
            </pre>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setUe5Confirm(null)}
              disabled={ue5Sending}
              className="border-boss-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSendToUE5}
              disabled={ue5Sending}
              className="bg-agent-green hover:bg-agent-green/90 text-white gap-1.5"
            >
              {ue5Sending ? (
                <>Sending…</>
              ) : (
                <>
                  <Rocket className="w-3.5 h-3.5" />
                  Confirm & Execute
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

export const ChatMessage = memo(ChatMessageInner);
