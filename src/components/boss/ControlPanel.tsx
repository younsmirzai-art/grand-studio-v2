"use client";

import { Camera, Monitor, PictureInPicture2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/lib/stores/uiStore";

interface ControlPanelProps {
  onCaptureNow?: () => void;
}

export function ControlPanel({
  onCaptureNow,
}: ControlPanelProps) {
  const { liveViewVisible, setLiveViewVisible, pipViewportVisible, setPipViewportVisible } = useUIStore();

  return (
    <div className="flex items-center gap-2">
      {onCaptureNow && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={onCaptureNow}
              className="border-boss-border hover:border-agent-teal/50 text-text-secondary hover:text-agent-teal gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              Capture
            </Button>
          </TooltipTrigger>
          <TooltipContent>Take UE5 viewport screenshot</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant={pipViewportVisible ? "secondary" : "ghost"}
            onClick={() => setPipViewportVisible(!pipViewportVisible)}
            className="gap-1.5 text-text-secondary"
          >
            <PictureInPicture2 className="w-3.5 h-3.5" />
            PiP View
          </Button>
        </TooltipTrigger>
        <TooltipContent>Floating viewport in corner; watch UE5 while chatting</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant={liveViewVisible ? "secondary" : "ghost"}
            onClick={() => setLiveViewVisible(!liveViewVisible)}
            className="gap-1.5 text-text-secondary"
          >
            <Monitor className="w-3.5 h-3.5" />
            Live View
          </Button>
        </TooltipTrigger>
        <TooltipContent>Toggle Live View panel</TooltipContent>
      </Tooltip>
    </div>
  );
}
