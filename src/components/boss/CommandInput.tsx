"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Crown, Send, Loader2, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useUIStore } from "@/lib/stores/uiStore";

interface CommandInputProps {
  onSend: (message: string, file?: File) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function CommandInput({ onSend, disabled, placeholder }: CommandInputProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatPresetMessage = useUIStore((s) => s.chatPresetMessage);
  const setChatPresetMessage = useUIStore((s) => s.setChatPresetMessage);

  useEffect(() => {
    if (chatPresetMessage) {
      setValue(chatPresetMessage);
      setChatPresetMessage(null);
      textareaRef.current?.focus();
    }
  }, [chatPresetMessage, setChatPresetMessage]);

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    const fileToSend = attachmentFile;
    try {
      await onSend(trimmed, fileToSend ?? undefined);
      setValue("");
      setAttachmentFile(null);
      if (attachmentPreview) {
        URL.revokeObjectURL(attachmentPreview);
        setAttachmentPreview(null);
      }
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  }, [value, sending, disabled, onSend, attachmentFile, attachmentPreview]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type.startsWith("image/")) {
      if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
      setAttachmentFile(f);
      setAttachmentPreview(URL.createObjectURL(f));
    }
    e.target.value = "";
  }, [attachmentPreview]);

  const clearAttachment = useCallback(() => {
    setAttachmentFile(null);
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
      setAttachmentPreview(null);
    }
  }, [attachmentPreview]);

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
        {attachmentPreview && (
          <div className="px-4 pt-2 flex items-center gap-2">
            <img src={attachmentPreview} alt="Attach" className="h-12 w-12 rounded border border-boss-border object-cover" />
            <button type="button" onClick={clearAttachment} className="p-1 rounded hover:bg-boss-border text-text-muted">
              <X className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-text-muted">Image attached</span>
          </div>
        )}
        <div className="flex items-start gap-3 p-4 pt-3">
          <div className="mt-1 w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
            <Crown className="w-4 h-4 text-gold" />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileChange}
          />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholder ?? "Describe what you want to build…"}
            disabled={disabled || sending}
            rows={1}
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted resize-none outline-none text-sm min-h-[36px] py-1.5"
          />
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              className="text-text-muted hover:text-text-primary h-8 w-8 p-0"
              title="Attach image (e.g. for Image to 3D)"
            >
              <ImagePlus className="w-4 h-4" />
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
            Ctrl+Enter to send to Grand Studio
          </span>
          <span className="text-[11px] text-text-muted">
            {value.length > 0 && `${value.length} chars`}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
