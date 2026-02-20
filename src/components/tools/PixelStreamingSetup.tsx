"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, ChevronRight } from "lucide-react";

interface PixelStreamingSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  {
    title: "Enable Pixel Streaming plugin",
    body: "In UE5 Editor: Edit → Plugins → search 'Pixel Streaming' → enable 'Pixel Streaming' plugin. Restart editor if prompted.",
  },
  {
    title: "Enable Pixel Streaming Player plugin",
    body: "Edit → Plugins → enable 'Pixel Streaming Player' (under Media & Entertainment). Restart if needed.",
  },
  {
    title: "Configure signaling server URL",
    body: "In Grand Studio Project Settings, set the Signaling Server URL (default: ws://localhost:8888). This is where UE5 will listen when started with Pixel Streaming.",
  },
  {
    title: "Start UE5 with Pixel Streaming",
    body: "Launch your project from a command line or shortcut with: -PixelStreamingURL=ws://localhost:8888 (or your URL). Or use Editor Preferences → Pixel Streaming to set the URL and start the stream from the editor.",
  },
  {
    title: "Test connection",
    body: "Click 'Test Connection' in Project Settings. If connected, the Live View will show the interactive stream instead of screenshots.",
  },
];

export function PixelStreamingSetup({ open, onOpenChange }: PixelStreamingSetupProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-boss-card border-boss-border text-text-primary">
        <DialogHeader>
          <DialogTitle className="text-text-primary">How to set up Pixel Streaming</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded ${i <= step ? "bg-agent-teal" : "bg-boss-border"}`}
              />
            ))}
          </div>
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-1">
              Step {step + 1}: {current.title}
            </h4>
            <p className="text-sm text-text-secondary">{current.body}</p>
          </div>
          <div className="flex justify-between pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="text-text-secondary"
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStep((s) => s + 1)}
                className="gap-1 border-boss-border"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => onOpenChange(false)} className="gap-1">
                <Check className="w-3.5 h-3.5" />
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
