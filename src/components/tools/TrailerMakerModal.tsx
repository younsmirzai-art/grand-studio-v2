"use client";

import { useState } from "react";
import { Film, Rocket, Send, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/stores/uiStore";
import { toast } from "sonner";
import {
  trailerTemplates,
  type TrailerTemplateKey,
  buildTrailerPlan,
  generateTrailerCode,
} from "@/lib/trailer/trailerEngine";

interface TrailerMakerModalProps {
  projectId: string;
}

export function TrailerMakerModal({ projectId }: TrailerMakerModalProps) {
  const open = useUIStore((s) => s.trailerModalOpen);
  const setOpen = useUIStore((s) => s.setTrailerModalOpen);
  const setChatPresetMessage = useUIStore((s) => s.setChatPresetMessage);

  const [templateKey, setTemplateKey] = useState<TrailerTemplateKey>("epic_reveal");
  const [title, setTitle] = useState("Cinematic Trailer");
  const [resolution, setResolution] = useState<"1080p" | "4K">("1080p");
  const [sending, setSending] = useState(false);

  const template = trailerTemplates[templateKey];
  const plan = buildTrailerPlan(templateKey, title, resolution);

  const handleCreateCameras = async () => {
    setSending(true);
    try {
      const code = generateTrailerCode(plan);
      const res = await fetch("/api/ue5/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, code, agentName: "Boss" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send trailer code to UE5");
        return;
      }
      toast.success(`${plan.shots.length} trailer cameras queued for UE5`);
      setOpen(false);
    } catch {
      toast.error("Failed to send to UE5");
    } finally {
      setSending(false);
    }
  };

  const handleAskNimaToPlan = () => {
    setChatPresetMessage?.(
      "@nima Plan a cinematic trailer shot list for this project: shot names, camera positions (x,y,z), rotations (pitch, yaw, roll), duration per shot, and camera movement (static, dolly_forward, orbit, etc.). Format as [TRAILER template: description] with a shot list so Thomas can place the cameras in UE5."
    );
    setOpen(false);
    toast.info("Chat opened — Nima will plan the trailer shots");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-boss-surface border-boss-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-text-primary">
            <Film className="w-5 h-5 text-agent-amber" />
            Trailer Maker
          </DialogTitle>
          <DialogDescription className="text-text-muted">
            Place cinematic cameras in UE5 for Movie Pipeline / Sequencer. Choose a template or ask Nima to plan a custom trailer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs text-text-muted mb-1.5 block">Template</label>
            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value as TrailerTemplateKey)}
              className="w-full px-3 py-2 rounded-lg bg-boss-elevated border border-boss-border text-text-primary text-sm"
            >
              {(Object.keys(trailerTemplates) as TrailerTemplateKey[]).map((key) => (
                <option key={key} value={key}>
                  {trailerTemplates[key].name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-text-muted mt-1">{template.description}</p>
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1.5 block">Trailer title (for camera labels)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-boss-elevated border border-boss-border text-text-primary text-sm"
              placeholder="Cinematic Trailer"
            />
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1.5 block">Resolution</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as "1080p" | "4K")}
              className="w-full px-3 py-2 rounded-lg bg-boss-elevated border border-boss-border text-text-primary text-sm"
            >
              <option value="1080p">1080p (1920×1080)</option>
              <option value="4K">4K (3840×2160)</option>
            </select>
          </div>

          <div>
            <p className="text-xs text-text-muted mb-2">Shots ({plan.shots.length})</p>
            <ul className="space-y-1 max-h-32 overflow-y-auto rounded-lg bg-boss-elevated/50 border border-boss-border p-2">
              {plan.shots.map((shot, i) => (
                <li key={shot.id} className="flex items-center justify-between text-xs">
                  <span className="text-text-primary">
                    {i + 1}. {shot.name}
                  </span>
                  <span className="text-text-muted">
                    {shot.duration}s · {shot.cameraMovement}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-text-muted mt-1">Total: {plan.totalDuration}s</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleCreateCameras}
              disabled={sending}
              className="gap-2 bg-agent-green hover:bg-agent-green/90 text-white"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              Create Trailer Cameras
            </Button>
            <Button
              variant="outline"
              onClick={handleAskNimaToPlan}
              className="gap-2 border-boss-border text-text-secondary hover:text-text-primary"
            >
              <Send className="w-4 h-4" />
              Ask Nima to plan custom trailer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
