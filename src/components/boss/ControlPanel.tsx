"use client";

import { Play, Square, SkipForward, Loader2, Camera, Monitor, Rocket, Pause, SquareStop, PictureInPicture2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProjectStore } from "@/lib/stores/projectStore";
import { useUIStore } from "@/lib/stores/uiStore";

interface ControlPanelProps {
  onRunOneTurn: () => Promise<void>;
  onStartAutonomous: () => void;
  onStopAutonomous: () => void;
  isRunningTurn: boolean;
  onCaptureNow?: () => void;
  onFullProjectClick?: () => void;
  onFullProjectPause?: () => void;
  onFullProjectResume?: () => void;
  onFullProjectStop?: () => void;
}

export function ControlPanel({
  onRunOneTurn,
  onStartAutonomous,
  onStopAutonomous,
  isRunningTurn,
  onCaptureNow,
  onFullProjectClick,
  onFullProjectPause,
  onFullProjectResume,
  onFullProjectStop,
}: ControlPanelProps) {
  const isAutonomous = useProjectStore((s) => s.isAutonomousRunning);
  const isFullProject = useProjectStore((s) => s.isFullProjectRunning);
  const isFullProjectPaused = useProjectStore((s) => s.isFullProjectPaused);
  const { liveViewVisible, setLiveViewVisible, pipViewportVisible, setPipViewportVisible } = useUIStore();

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            onClick={onRunOneTurn}
            disabled={isRunningTurn || isAutonomous || isFullProject}
            className="border-boss-border hover:border-boss-border-focus text-text-secondary hover:text-text-primary gap-1.5"
          >
            {isRunningTurn ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <SkipForward className="w-3.5 h-3.5" />
            )}
            One Turn
          </Button>
        </TooltipTrigger>
        <TooltipContent>Run a single agent turn</TooltipContent>
      </Tooltip>

      {isAutonomous ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={onStopAutonomous}
              className="bg-agent-rose/10 hover:bg-agent-rose/20 text-agent-rose border border-agent-rose/20 gap-1.5"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop autonomous cycle</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={onStartAutonomous}
              disabled={isRunningTurn || isFullProject}
              className="bg-agent-green/10 hover:bg-agent-green/20 text-agent-green border border-agent-green/20 gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              Auto
            </Button>
          </TooltipTrigger>
          <TooltipContent>Start autonomous agent cycle</TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`w-2 h-2 rounded-full ${isAutonomous || isFullProject ? "bg-agent-green animate-pulse" : "bg-text-muted"}`} />
        </TooltipTrigger>
        <TooltipContent>{isAutonomous ? "Autonomous mode active" : isFullProject ? "Full Project running" : "Idle"}</TooltipContent>
      </Tooltip>

      {onFullProjectClick && !isFullProject && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={onFullProjectClick}
              disabled={isRunningTurn || isAutonomous}
              className="border-gold/30 hover:border-gold/50 text-gold hover:bg-gold/10 gap-1.5"
            >
              <Rocket className="w-3.5 h-3.5" />
              🚀 Full Project
            </Button>
          </TooltipTrigger>
          <TooltipContent>Run full project autonomously (plan + execute all tasks)</TooltipContent>
        </Tooltip>
      )}
      {isFullProject && (
        <>
          {isFullProjectPaused ? (
            onFullProjectResume && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={onFullProjectResume} className="border-agent-green/30 text-agent-green hover:bg-agent-green/10 gap-1.5">
                    <Play className="w-3.5 h-3.5" />
                    ▶️ Resume
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Resume Full Project</TooltipContent>
              </Tooltip>
            )
          ) : (
            onFullProjectPause && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={onFullProjectPause} className="border-agent-amber/30 text-agent-amber hover:bg-agent-amber/10 gap-1.5">
                    <Pause className="w-3.5 h-3.5" />
                    ⏸️ Pause
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Pause Full Project</TooltipContent>
              </Tooltip>
            )
          )}
          {onFullProjectStop && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={onFullProjectStop} className="border-agent-rose/30 text-agent-rose hover:bg-agent-rose/10 gap-1.5">
                  <SquareStop className="w-3.5 h-3.5" />
                  ⏹️ Stop
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stop Full Project</TooltipContent>
            </Tooltip>
          )}
        </>
      )}

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
