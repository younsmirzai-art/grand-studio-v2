"use client";

import { useState, useRef, useCallback } from "react";
import { Crown, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface CommandInputProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function CommandInput({ onSend, disabled, placeholder }: CommandInputProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <div className="relative rounded-xl border border-gold/30 bg-boss-card gold-glow overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <div className="mt-1 w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
            <Crown className="w-4 h-4 text-gold" />
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholder ?? "Give your team an order, ریس..."}
            disabled={disabled || sending}
            rows={1}
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted resize-none outline-none text-sm min-h-[36px] py-1.5"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!value.trim() || sending || disabled}
            className="bg-gold hover:bg-gold/90 text-boss-bg font-semibold shrink-0 mt-0.5"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="px-4 pb-2 flex items-center justify-between">
          <span className="text-[11px] text-text-muted">
            Ctrl+Enter to send
          </span>
          <span className="text-[11px] text-text-muted">
            {value.length > 0 && `${value.length} chars`}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
