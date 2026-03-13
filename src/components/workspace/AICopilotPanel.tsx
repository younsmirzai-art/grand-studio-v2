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
} from "lucide-react";
import { ScreenshotPreview } from "@/components/chat/ScreenshotPreview";
import type { ChatTurn } from "@/lib/types";

interface AICopilotPanelProps {
  open: boolean;
  onClose: () => void;
  chatTurns: ChatTurn[];
  isGenerating: boolean;
  streamingContent: string;
  onSend: (message: string) => void;
  disabled?: boolean;
  prefillMessage?: string | null;
  onClearPrefill?: () => void;
}

const SUGGESTIONS = [
  "Build a medieval house",
  "Create a forest scene",
  "Import rocks from Poly Haven",
  "Change lighting to sunset",
];

const WELCOME_MESSAGE = `Hey! I'm your AI Co-Pilot for Unreal Engine 5.

I can help you:
• **Build scenes** — houses, castles, forests, cities
• **Import 3D models** from Poly Haven and Sketchfab
• **Add materials**, lighting, and atmosphere
• **Take screenshots** and improve your scene

What would you like to build today?`;

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
}: AICopilotPanelProps) {
  const [input, setInput] = useState("");
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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatTurns, streamingContent]);

  const handleSend = useCallback(() => {
    const msg = input.trim();
    if (!msg || disabled) return;
    onSend(msg);
    setInput("");
  }, [input, disabled, onSend]);

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
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] ${
                        isUser
                          ? "bg-[#2196F3]/10 rounded-xl rounded-br-sm p-3 ml-8"
                          : "p-3 mr-8"
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
                  disabled={disabled}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder:text-[#606068] resize-none outline-none focus:border-[#2196F3]/50 focus:shadow-[0_0_20px_rgba(33,150,243,0.1)] transition disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || disabled}
                  className="absolute right-3 bottom-3 w-8 h-8 rounded-lg bg-[#2196F3] flex items-center justify-center text-white disabled:opacity-30 hover:bg-[#2196F3]/90 transition"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
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
