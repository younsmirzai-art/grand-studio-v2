"use client";

import { useState } from "react";
import { Mic, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface VoiceGeneratorProps {
  projectId: string;
}

export function VoiceGenerator({ projectId }: VoiceGeneratorProps) {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("21m00Tcm4TlvDq8ikWAM");
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setGenerating(true);

    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": "", // User needs to provide this
          },
          body: JSON.stringify({
            text: text.trim(),
            model_id: "eleven_monolingual_v1",
          }),
        }
      );

      if (res.ok) {
        const blob = await res.blob();
        setAudioUrl(URL.createObjectURL(blob));
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-boss-card border border-boss-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-boss-border">
        <Mic className="w-4 h-4 text-agent-rose" />
        <span className="text-sm font-medium text-text-primary">Voice Generator</span>
      </div>

      <div className="p-3 space-y-3">
        <Input
          placeholder="ElevenLabs Voice ID"
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          className="bg-boss-surface border-boss-border text-xs h-8"
        />
        <Textarea
          placeholder="Enter dialogue text..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="bg-boss-surface border-boss-border text-xs resize-none"
        />
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={generating || !text.trim()}
          className="w-full bg-agent-rose/10 hover:bg-agent-rose/20 text-agent-rose border border-agent-rose/20 gap-1.5"
        >
          {generating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Mic className="w-3.5 h-3.5" />
          )}
          Generate Voice
        </Button>

        {audioUrl && (
          <audio controls className="w-full" src={audioUrl}>
            <track kind="captions" />
          </audio>
        )}
      </div>
    </div>
  );
}
