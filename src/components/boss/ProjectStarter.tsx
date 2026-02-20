"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Crown, Loader2, Mic } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/agents/types";
import { startListening, normalizeAtMention } from "@/lib/voice/speechRecognition";

interface ProjectStarterProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export function ProjectStarter({ open, onClose, onCreated }: ProjectStarterProps) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<ReturnType<typeof startListening> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
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
    if (loading) return;

    recognitionRef.current = startListening(
      (text) => {
        stopListening();
        setPrompt((prev) => {
          const next = normalizeAtMention(text);
          return prev ? `${prev} ${next}` : next;
        });
      },
      () => {
        stopListening();
      }
    );

    if (recognitionRef.current) {
      setIsListening(true);
      silenceTimerRef.current = setTimeout(stopListening, 10000);
    }
  }, [isListening, loading, stopListening]);

  const handleCreate = async () => {
    if (!name.trim() || !prompt.trim()) return;
    setLoading(true);

    const supabase = getClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        initial_prompt: prompt.trim(),
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create project:", error);
      setLoading(false);
      return;
    }

    setName("");
    setPrompt("");
    setLoading(false);
    onCreated(data as Project);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-boss-card border-boss-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-text-primary">
            <Crown className="w-5 h-5 text-gold" />
            New Project
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">
              Project Name
            </label>
            <Input
              placeholder="e.g., Dark Fantasy RPG"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-boss-surface border-boss-border text-text-primary placeholder:text-text-muted focus:border-gold/50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-text-secondary">
                Initial Command for the Team
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={toggleVoice}
                disabled={loading}
                className={`h-7 w-7 p-0 rounded-full ${
                  isListening
                    ? "bg-red-500/20 text-red-500 animate-pulse"
                    : "text-text-muted hover:text-text-primary"
                }`}
                title={isListening ? "Stop listening" : "Voice input"}
              >
                <Mic className="w-3.5 h-3.5" />
              </Button>
            </div>
            {isListening && (
              <p className="text-[11px] text-red-500 mb-1">🔴 Listening…</p>
            )}
            <Textarea
              placeholder="Describe what you want to build. Be as detailed as possible — your AI team will break this down into tasks."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              className="bg-boss-surface border-boss-border text-text-primary placeholder:text-text-muted focus:border-gold/50 resize-none"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-boss-border text-text-secondary hover:bg-boss-elevated"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || !prompt.trim() || loading}
              className="bg-gold hover:bg-gold/90 text-boss-bg font-semibold gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Crown className="w-4 h-4" />
              )}
              Create & Enter
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
