"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Crown, Send, Loader2, AtSign, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { TEAM } from "@/lib/agents/identity";
import { startListening, normalizeAtMention } from "@/lib/voice/speechRecognition";
import { useUIStore } from "@/lib/stores/uiStore";

interface CommandInputProps {
  onSend: (message: string) => Promise<void>;
  onSendDirect?: (agentName: string) => (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  agentNames?: string[];
}

const MAX_LISTEN_SEC = 10;

export function CommandInput({ onSend, disabled, placeholder }: CommandInputProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<ReturnType<typeof startListening> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatPresetMessage = useUIStore((s) => s.chatPresetMessage);
  const setChatPresetMessage = useUIStore((s) => s.setChatPresetMessage);

  useEffect(() => {
    if (chatPresetMessage) {
      setValue(chatPresetMessage);
      setChatPresetMessage(null);
      textareaRef.current?.focus();
    }
  }, [chatPresetMessage, setChatPresetMessage]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const toggleVoice = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }
    if (disabled || sending) return;

    recognitionRef.current = startListening(
      (text) => {
        stopListening();
        setValue((prev) => {
          const next = normalizeAtMention(text);
          return prev ? `${prev} ${next}` : next;
        });
        textareaRef.current?.focus();
      },
      (err) => {
        stopListening();
        console.error("Speech recognition error:", err);
      }
    );

    if (recognitionRef.current) {
      setIsListening(true);
      silenceTimerRef.current = setTimeout(() => {
        stopListening();
      }, MAX_LISTEN_SEC * 1000);
    }
  }, [isListening, disabled, sending, stopListening]);

  const detectedAgent = useMemo(() => {
    const match = value.match(/^@(\w+)/);
    if (!match) return null;
    const name = match[1].toLowerCase();
    return TEAM.find((a) => a.name.toLowerCase() === name) ?? null;
  }, [value]);

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  }, [value, sending, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  };

  const selectAgent = (name: string) => {
    setValue(`@${name.toLowerCase()} `);
    setShowAgentPicker(false);
    textareaRef.current?.focus();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <AnimatePresence>
        {showAgentPicker && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-full mb-2 left-0 right-0 bg-boss-card border border-boss-border rounded-lg p-2 flex gap-1.5 flex-wrap z-10"
          >
            <span className="text-[11px] text-text-muted w-full mb-1">Direct message an agent:</span>
            {TEAM.map((agent) => (
              <Button
                key={agent.name}
                size="sm"
                variant="ghost"
                onClick={() => selectAgent(agent.name)}
                className="h-7 px-2.5 text-xs gap-1.5 border border-boss-border hover:border-current"
                style={{ color: agent.colorHex }}
              >
                <span className="text-sm">{agent.icon}</span>
                {agent.name}
              </Button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`relative rounded-xl border ${detectedAgent ? "border-current" : "border-gold/30"} bg-boss-card gold-glow overflow-hidden`}
        style={detectedAgent ? { borderColor: detectedAgent.colorHex + "60" } : undefined}
      >
        {detectedAgent && (
          <div className="px-4 pt-2 flex items-center gap-1.5">
            <span className="text-sm">{detectedAgent.icon}</span>
            <span className="text-xs font-medium" style={{ color: detectedAgent.colorHex }}>
              Direct to {detectedAgent.name}
            </span>
            <span className="text-[10px] text-text-muted">({detectedAgent.title})</span>
          </div>
        )}

        <div className="flex items-start gap-3 p-4 pt-3">
          <div className="mt-1 w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
            <Crown className="w-4 h-4 text-gold" />
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholder ?? "Give your team an order... (use @name for direct chat)"}
            disabled={disabled || sending}
            rows={1}
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted resize-none outline-none text-sm min-h-[36px] py-1.5"
          />
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleVoice}
              disabled={disabled || sending}
              className={`h-8 w-8 p-0 rounded-full ${
                isListening
                  ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 animate-pulse"
                  : "text-text-muted hover:text-text-primary"
              }`}
              title={isListening ? "Stop listening" : "Voice command (speak to type)"}
            >
              <Mic className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAgentPicker(!showAgentPicker)}
              className="text-text-muted hover:text-gold h-8 w-8 p-0"
              title="Pick agent for direct chat"
            >
              <AtSign className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!value.trim() || sending || disabled}
              className="bg-gold hover:bg-gold/90 text-boss-bg font-semibold"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="px-4 pb-2 flex items-center justify-between">
          <span className="text-[11px] text-text-muted">
            {isListening ? (
              <span className="text-red-500 font-medium">🔴 Listening… (click mic to stop, or speak)</span>
            ) : (
              <>Ctrl+Enter to send {detectedAgent ? `to ${detectedAgent.name}` : "to all"}</>
            )}
          </span>
          <span className="text-[11px] text-text-muted">
            {value.length > 0 && `${value.length} chars`}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
