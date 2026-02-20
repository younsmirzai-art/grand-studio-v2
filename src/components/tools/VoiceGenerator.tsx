"use client";

import { useState, useEffect } from "react";
import { Mic, Play, Save, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/stores/uiStore";
import { toast } from "sonner";

interface VoiceGeneratorModalProps {
  projectId: string;
}

const VOICE_TYPES = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export function VoiceGeneratorModal({ projectId }: VoiceGeneratorModalProps) {
  const open = useUIStore((s) => s.voiceModalOpen);
  const setOpen = useUIStore((s) => s.setVoiceModalOpen);

  const [characterName, setCharacterName] = useState("");
  const [dialogue, setDialogue] = useState("");
  const [voiceType, setVoiceType] = useState("male");
  const [scene, setScene] = useState("");
  const [saving, setSaving] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const load = () => setVoices(window.speechSynthesis.getVoices());
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  }, []);

  const handleSpeak = () => {
    if (!dialogue.trim()) return;
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("Speech synthesis not supported in this browser");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(dialogue.trim());
    const preferred = voices.filter((v) =>
      voiceType === "female" ? v.name.toLowerCase().includes("female") || v.name.includes("Samantha") : v.name.toLowerCase().includes("male") || v.name.includes("Daniel")
    );
    if (preferred.length > 0) utterance.voice = preferred[0];
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
    toast.success("Playing...");
  };

  const handleSave = async () => {
    if (!characterName.trim() || !dialogue.trim()) {
      toast.error("Character name and dialogue required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/tools/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          characterName: characterName.trim(),
          dialogue: dialogue.trim(),
          voiceType,
          scene: scene.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Saved to project");
        setCharacterName("");
        setDialogue("");
        setScene("");
      } else {
        const err = await res.json();
        toast.error(err.error || "Save failed");
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(!!o)}>
      <DialogContent className="bg-boss-card border-boss-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-text-primary">
            <Mic className="w-5 h-5 text-agent-amber" />
            Voice Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">Character Name</label>
            <Input
              placeholder="e.g. Hero, Villain, NPC_Guard"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              className="bg-boss-surface border-boss-border text-text-primary"
            />
          </div>

          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">Dialogue Line</label>
            <Textarea
              placeholder="Enter the line to speak..."
              value={dialogue}
              onChange={(e) => setDialogue(e.target.value)}
              rows={3}
              className="bg-boss-surface border-boss-border text-text-primary resize-none"
            />
          </div>

          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">Voice Type</label>
            <select
              value={voiceType}
              onChange={(e) => setVoiceType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-boss-surface border border-boss-border text-text-primary text-sm"
            >
              {VOICE_TYPES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">Scene (optional)</label>
            <Input
              placeholder="e.g. Intro, Battle, Cutscene_1"
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              className="bg-boss-surface border-boss-border text-text-primary"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSpeak}
              disabled={!dialogue.trim()}
              variant="outline"
              className="border-agent-amber/30 text-agent-amber hover:bg-agent-amber/10 gap-2"
            >
              <Play className="w-4 h-4" />
              Generate (Preview)
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !characterName.trim() || !dialogue.trim()}
              className="bg-gold hover:bg-gold/90 text-boss-bg gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save to Project
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
