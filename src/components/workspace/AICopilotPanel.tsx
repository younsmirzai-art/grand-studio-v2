"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  ChevronDown,
  ArrowUp,
  Copy,
  Check,
  Loader2,
  MessageCircle,
  Bot,
  Folder,
  Download,
  GitMerge,
  Star,
  Trash2,
} from "lucide-react";
import { ScreenshotPreview } from "@/components/chat/ScreenshotPreview";
import type { ChatTurn } from "@/lib/types";

export type AgentAssetSourceChoice = "my_assets" | "library" | "both";

interface AICopilotPanelProps {
  open: boolean;
  onClose: () => void;
  chatTurns: ChatTurn[];
  isGenerating: boolean;
  streamingContent: string;
  onSend: (message: string, mode: "ask" | "agent") => void;
  /** When set, user must pick how to source assets before the agent runs. */
  pendingAgentMessage: string | null;
  onAgentAssetSource: (choice: AgentAssetSourceChoice) => void;
  onCancelPendingAgent?: () => void;
  disabled?: boolean;
  prefillMessage?: string | null;
  onClearPrefill?: () => void;
  /** Remove one turn from Supabase + UI (optional). */
  onDeleteChatTurn?: (turnId: number) => void;
  /** Start a fresh in-panel thread without deleting stored history. */
  onNewChat?: () => void;
}

const SUGGESTIONS = [
  "Build a medieval house",
  "Create a forest scene",
  "Import rocks from our 3D library",
  "Change lighting to sunset",
];

const WELCOME_MESSAGE = `Hey! 👋 I'm Grand Studio — your AI Co-Pilot for Unreal Engine 5.

I can help you build amazing 3D scenes:
🏰 Buildings and architecture
🌲 Nature and landscapes
💡 Lighting and atmosphere
📦 Import thousands of professional 3D models

Just tell me what you want to build, and I'll make it happen!

What would you like to create today?`;

export function AICopilotPanel({
  open,
  onClose,
  chatTurns,
  isGenerating,
  streamingContent,
  onSend,
  disabled,
  prefillMessage,
  onClearPrefill,
  onDeleteChatTurn,
  onNewChat,
  pendingAgentMessage,
  onAgentAssetSource,
  onCancelPendingAgent,
}: AICopilotPanelProps) {
  const [input, setInput] = useState("");
  const [aiMode, setAiMode] = useState<"ask" | "agent">("ask");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (prefillMessage && open) {
      setInput(prefillMessage);
      onClearPrefill?.();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [prefillMessage, open, onClearPrefill]);

  useEffect(() => {
    if (aiMode === "ask" && pendingAgentMessage) {
      onCancelPendingAgent?.();
    }
  }, [aiMode, pendingAgentMessage, onCancelPendingAgent]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatTurns, streamingContent]);

  const handleSend = useCallback(() => {
    const msg = input.trim();
    if (!msg || disabled) return;
    if (aiMode === "agent" && pendingAgentMessage) {
      return;
    }
    onSend(msg, aiMode);
    setInput("");
  }, [input, disabled, onSend, aiMode, pendingAgentMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const extractCodeBlocks = (content: string) => {
    const blocks: { before: string; code: string; lang: string }[] = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      blocks.push({
        before: content.slice(lastIndex, match.index),
        code: match[2],
        lang: match[1] || "python",
      });
      lastIndex = match.index + match[0].length;
    }
    const remaining = content.slice(lastIndex);
    return { blocks, remaining };
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-6 right-6 z-[61] w-[520px] max-h-[70vh] flex flex-col rounded-2xl border border-[#2196F3]/20 bg-[#111114]/95 backdrop-blur-2xl shadow-2xl shadow-blue-500/10"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#2196F3]" />
                <span className="text-sm font-semibold text-[#2196F3]">
                  AI Co-Pilot
                </span>
                {isGenerating && (
                  <span className="flex items-center gap-1.5 text-xs text-[#00BCD4]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Working...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {onNewChat && (
                  <button
                    type="button"
                    onClick={onNewChat}
                    disabled={disabled}
                    className="px-2 py-1 rounded-lg text-[11px] font-medium text-[#2196F3] hover:bg-[#2196F3]/10 border border-[#2196F3]/25 transition disabled:opacity-40"
                    title="Start a new conversation (history stays saved)"
                  >
                    New Chat
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[#606068] hover:text-white hover:bg-white/5 transition"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[#606068] hover:text-white hover:bg-white/5 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 scrollbar-thin">
              {chatTurns.length === 0 && !isGenerating && (
                <div className="flex justify-start">
                  <div className="p-4 mr-6 max-w-[90%] rounded-xl bg-[#2196F3]/5 border border-[#2196F3]/10">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#2196F3]" />
                      <span className="text-xs font-semibold text-[#2196F3]">
                        Grand Studio AI
                      </span>
                    </div>
                    <div className="text-sm text-[#E0E0E0] whitespace-pre-wrap leading-relaxed">
                      {WELCOME_MESSAGE}
                    </div>
                  </div>
                </div>
              )}

              {chatTurns.map((turn, i) => {
                const isUser = turn.turn_type === "boss_command";
                const { blocks, remaining } = extractCodeBlocks(turn.content);

                return (
                  <div
                    key={turn.id}
                    className={`flex gap-1.5 items-start ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && onDeleteChatTurn && (
                      <button
                        type="button"
                        onClick={() => onDeleteChatTurn(turn.id)}
                        disabled={disabled}
                        className="mt-1 p-1.5 rounded-lg text-[#606068] hover:text-agent-rose hover:bg-white/5 transition shrink-0 disabled:opacity-40"
                        title="Delete this message"
                        aria-label="Delete this message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div
                      className={`max-w-[85%] ${
                        isUser
                          ? "bg-[#2196F3]/10 rounded-xl rounded-br-sm p-3 ml-4"
                          : "p-3 mr-4"
                      }`}
                    >
                      {!isUser && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Sparkles className="w-3 h-3 text-[#2196F3]" />
                          <span className="text-xs font-medium text-[#2196F3]">
                            AI
                          </span>
                          <span className="text-[10px] text-[#606068]">
                            {new Date(turn.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      )}

                      {blocks.length > 0 ? (
                        <>
                          {blocks.map((block, bi) => (
                            <div key={bi}>
                              {block.before && (
                                <p className="text-sm text-[#E0E0E0] whitespace-pre-wrap mb-2">
                                  {block.before}
                                </p>
                              )}
                              <div className="relative group rounded-lg bg-[#0A0A0B] border border-white/5 overflow-hidden mb-2">
                                <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-white/[0.02]">
                                  <span className="text-[10px] text-[#606068] uppercase">
                                    {block.lang}
                                  </span>
                                  <button
                                    onClick={() =>
                                      handleCopyCode(block.code, i * 10 + bi)
                                    }
                                    className="text-[#606068] hover:text-white transition p-1"
                                  >
                                    {copiedIdx === i * 10 + bi ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                                <pre className="p-3 text-xs text-[#E0E0E0] overflow-x-auto font-mono leading-relaxed">
                                  {block.code.length > 500
                                    ? block.code.slice(0, 500) + "\n..."
                                    : block.code}
                                </pre>
                              </div>
                            </div>
                          ))}
                          {remaining && (
                            <p className="text-sm text-[#E0E0E0] whitespace-pre-wrap">
                              {remaining}
                            </p>
                          )}
                        </>
                      ) : (
                        <p
                          className={`text-sm whitespace-pre-wrap ${
                            isUser ? "text-white" : "text-[#E0E0E0]"
                          }`}
                        >
                          {turn.content.length > 600
                            ? turn.content.slice(0, 600) + "..."
                            : turn.content}
                        </p>
                      )}

                      {turn.screenshot_url && (
                        <div className="mt-2">
                          <ScreenshotPreview
                            url={turn.screenshot_url}
                            timestamp={turn.created_at}
                          />
                        </div>
                      )}
                    </div>
                    {isUser && onDeleteChatTurn && (
                      <button
                        type="button"
                        onClick={() => onDeleteChatTurn(turn.id)}
                        disabled={disabled}
                        className="mt-1 p-1.5 rounded-lg text-[#606068] hover:text-agent-rose hover:bg-white/5 transition shrink-0 disabled:opacity-40"
                        title="Delete this message"
                        aria-label="Delete this message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {isGenerating && streamingContent && (
                <div className="flex justify-start">
                  <div className="p-3 mr-8 max-w-[85%]">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3 h-3 text-[#2196F3]" />
                      <span className="text-xs font-medium text-[#2196F3]">
                        AI
                      </span>
                    </div>
                    <pre className="text-sm text-[#E0E0E0] whitespace-pre-wrap font-sans">
                      {streamingContent.slice(0, 600)}
                    </pre>
                  </div>
                </div>
              )}

              {isGenerating && !streamingContent && (
                <div className="flex justify-start">
                  <div className="p-3 flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#2196F3] animate-pulse" />
                      <span className="w-2 h-2 rounded-full bg-[#2196F3] animate-pulse [animation-delay:0.15s]" />
                      <span className="w-2 h-2 rounded-full bg-[#2196F3] animate-pulse [animation-delay:0.3s]" />
                    </span>
                    <span className="text-xs text-[#606068]">
                      Grand Studio is thinking...
                    </span>
                  </div>
                </div>
              )}

              {pendingAgentMessage && !isGenerating && (
                <div className="flex flex-col gap-2 px-1">
                  <p className="text-xs text-[#A0A0A8]">
                    Choose asset source for:{" "}
                    <span className="text-[#E0E0E0] font-medium">
                      {pendingAgentMessage.length > 80
                        ? `${pendingAgentMessage.slice(0, 80)}…`
                        : pendingAgentMessage}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onAgentAssetSource("my_assets")}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-[#1A1A1F] text-xs text-[#E0E0E0] hover:border-[#2196F3]/40 hover:bg-[#2196F3]/10 transition"
                    >
                      <Folder className="w-3.5 h-3.5 shrink-0 text-[#90CAF9]" />
                      Use My Assets Only
                    </button>
                    <button
                      type="button"
                      onClick={() => onAgentAssetSource("library")}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-[#1A1A1F] text-xs text-[#E0E0E0] hover:border-[#00BCD4]/40 hover:bg-[#00BCD4]/10 transition"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0 text-[#4DD0E1]" />
                      Use Library Assets
                    </button>
                    <button
                      type="button"
                      onClick={() => onAgentAssetSource("both")}
                      className="relative inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#2196F3]/50 bg-[#2196F3]/15 text-xs text-white hover:bg-[#2196F3]/25 transition"
                    >
                      <GitMerge className="w-3.5 h-3.5 shrink-0 text-[#B7DFFF]" />
                      Use Both
                      <span className="inline-flex items-center gap-0.5 ml-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-[10px] font-semibold text-amber-200">
                        <Star className="w-2.5 h-2.5" />
                        Recommended
                      </span>
                    </button>
                  </div>
                  {onCancelPendingAgent && (
                    <button
                      type="button"
                      onClick={onCancelPendingAgent}
                      className="text-[10px] text-[#606068] hover:text-white self-start"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-white/5 p-4 shrink-0">
              {chatTurns.length === 0 && !isGenerating && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setInput(s);
                        inputRef.current?.focus();
                      }}
                      className="px-3 py-1 rounded-full bg-[#1A1A1F] border border-white/5 text-xs text-[#A0A0A8] hover:border-[#2196F3]/30 hover:text-white transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what to build... (Ctrl+Enter to send)"
                  rows={2}
                  disabled={disabled || (!!pendingAgentMessage && aiMode === "agent")}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder:text-[#606068] resize-none outline-none focus:border-[#2196F3]/50 focus:shadow-[0_0_20px_rgba(33,150,243,0.1)] transition disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || disabled || (!!pendingAgentMessage && aiMode === "agent")}
                  className="absolute right-3 bottom-3 w-8 h-8 rounded-lg bg-[#2196F3] flex items-center justify-center text-white disabled:opacity-30 hover:bg-[#2196F3]/90 transition"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAiMode("ask")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition ${
                    aiMode === "ask"
                      ? "bg-[#2196F3]/20 border-[#2196F3]/40 text-[#B7DFFF]"
                      : "bg-[#1A1A1F] border-white/10 text-[#A0A0A8] hover:text-white"
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Ask
                </button>
                <button
                  type="button"
                  onClick={() => setAiMode("agent")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition ${
                    aiMode === "agent"
                      ? "bg-[#2196F3]/20 border-[#2196F3]/40 text-[#B7DFFF]"
                      : "bg-[#1A1A1F] border-white/10 text-[#A0A0A8] hover:text-white"
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  Agent
                </button>
              </div>
              {aiMode === "agent" && (
                <p className="text-[10px] text-[#72C7FF] mt-2">
                  {pendingAgentMessage
                    ? "Pick an asset source above to start the agent."
                    : "Agent mode: after you send, choose whether to use your project assets, libraries, or both."}
                </p>
              )}
              <p className="text-[10px] text-[#606068] mt-2 text-center">
                Press Ctrl+Enter to send · Escape to close
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
