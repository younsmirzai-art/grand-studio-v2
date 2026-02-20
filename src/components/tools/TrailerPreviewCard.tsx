"use client";

import { useState } from "react";
import { Film, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  trailerTemplates,
  buildTrailerPlan,
  generateTrailerCode,
  type TrailerTemplateKey,
} from "@/lib/trailer/trailerEngine";

interface TrailerPreviewCardProps {
  templateKey: TrailerTemplateKey;
  description: string;
  projectId: string;
  onExecuteCode: (code: string, agentName?: string) => void | Promise<void>;
}

export function TrailerPreviewCard({
  templateKey,
  description,
  projectId,
  onExecuteCode,
}: TrailerPreviewCardProps) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const template = trailerTemplates[templateKey];
  const plan = buildTrailerPlan(templateKey, template.name, "1080p");

  const handleCreateInUE5 = async () => {
    if (sending || sent) return;
    setSending(true);
    try {
      const code = generateTrailerCode(plan);
      await onExecuteCode(code, "Boss");
      setSent(true);
      toast.success("Trailer cameras queued for UE5");
    } catch {
      toast.error("Failed to send to UE5");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="my-3 rounded-xl border border-boss-border bg-boss-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Film className="w-5 h-5 text-agent-amber" />
        <div>
          <p className="font-medium text-text-primary">{template.name}</p>
          {description && <p className="text-xs text-text-muted">{description}</p>}
        </div>
      </div>
      <p className="text-[11px] text-text-muted">{template.description}</p>
      <ul className="space-y-1 max-h-24 overflow-y-auto">
        {plan.shots.map((shot, i) => (
          <li key={shot.id} className="text-xs text-text-secondary flex justify-between">
            <span>{i + 1}. {shot.name}</span>
            <span className="text-text-muted">{shot.duration}s · {shot.cameraMovement}</span>
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        onClick={handleCreateInUE5}
        disabled={sending || sent}
        className="gap-2 bg-agent-green hover:bg-agent-green/90 text-white"
      >
        <Rocket className="w-3.5 h-3.5" />
        {sent ? "Sent to UE5" : sending ? "Sending…" : "Create in UE5"}
      </Button>
    </div>
  );
}
