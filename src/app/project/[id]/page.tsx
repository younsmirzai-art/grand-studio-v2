"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { CommandInput } from "@/components/boss/CommandInput";
import { ControlPanel } from "@/components/boss/ControlPanel";
import { TeamChat } from "@/components/team/TeamChat";
import { GodEyePanel } from "@/components/god-eye/GodEyePanel";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import LiveViewport from "@/components/tools/LiveViewport";
import PixelStreamingViewer from "@/components/tools/PixelStreamingViewer";
import { ImageTo3D } from "@/components/tools/ImageTo3D";
import Link from "next/link";
import { useProjectStore } from "@/lib/stores/projectStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { getClient } from "@/lib/supabase/client";
import { TEAM } from "@/lib/agents/identity";
import type { ChatTurn } from "@/lib/agents/types";
import { detectGamePresetInPrompt, gamePresets, generatePresetCode } from "@/lib/gameDNA/presets";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const AGENT_NAMES = TEAM.map((a) => a.name.toLowerCase());

function parseDirectMention(message: string): { agentName: string; cleanMessage: string } | null {
  const match = message.match(/^@(\w+)\s+([\s\S]+)/);
  if (!match) return null;
  const name = match[1].toLowerCase();
  const found = TEAM.find((a) => a.name.toLowerCase() === name);
  if (!found) return null;
  return { agentName: found.name, cleanMessage: match[2].trim() };
}

interface FullProjectStatus {
  running: boolean;
  status: string | null;
  currentTaskIndex: number;
  totalTasks: number;
  currentTaskTitle: string | null;
  plan: { title: string; status: string; assignedTo: string }[];
  summary: string | null;
}

export default function ProjectPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = params.id as string;
  const project = useProjectStore((s) => s.project);
  const { taskBoardVisible, setLiveViewVisible, liveViewVisible, pipViewportVisible, setPipViewportVisible, imageTo3DModalOpen, setImageTo3DModalOpen } = useUIStore();
  const { setAutonomousRunning, isAutonomousRunning, setChatTurns, setFullProjectRunning, isFullProjectRunning, isFullProjectPaused, setFullProjectPaused, isRelayConnected } = useProjectStore();
  const [pixelStreamingUrl, setPixelStreamingUrl] = useState<string | null>(null);
  const [pixelStreamingConnected, setPixelStreamingConnected] = useState(false);
  const [isRunningTurn, setIsRunningTurn] = useState(false);
  const [typingAgents, setTypingAgents] = useState<string[]>([]);
  const [fullProjectDialogOpen, setFullProjectDialogOpen] = useState(false);
  const [fullProjectPrompt, setFullProjectPrompt] = useState("");
  const [buildStatus, setBuildStatus] = useState<FullProjectStatus | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const autonomousRef = useRef(false);
  const autoBuildStartedRef = useRef(false);
  const showBuildingView = isFullProjectRunning || (buildStatus?.running ?? false);

  useEffect(() => {
    const supabase = getClient();
    supabase
      .from("project_settings")
      .select("pixel_streaming_url, pixel_streaming_connected")
      .eq("project_id", projectId)
      .single()
      .then(({ data }) => {
        if (data) {
          setPixelStreamingUrl(data.pixel_streaming_url ?? null);
          setPixelStreamingConnected(data.pixel_streaming_connected === true);
        }
      });
  }, [projectId]);

  const refetchChat = useCallback(async () => {
    const supabase = getClient();
    const { data } = await supabase
      .from("chat_turns")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (data) {
      setChatTurns(data as ChatTurn[]);
    }
  }, [projectId, setChatTurns]);

  const autoBuild = searchParams.get("autoBuild") === "1";
  useEffect(() => {
    if (!project?.id || !project?.initial_prompt || !autoBuild || autoBuildStartedRef.current) return;
    autoBuildStartedRef.current = true;
    const prompt = (project.initial_prompt as string).trim();
    setFullProjectRunning(true);
    setLiveViewVisible?.(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("autoBuild");
    router.replace(`/project/${projectId}${params.toString() ? `?${params}` : ""}`, { scroll: false });
    fetch("/api/agents/full-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, prompt }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) toast.error(data.error ?? "Full project failed");
      })
      .finally(() => {
        setFullProjectRunning(false);
        setFullProjectPaused(false);
        refetchChat();
      });
  }, [project?.id, project?.initial_prompt, autoBuild, projectId, searchParams, router, setFullProjectRunning, setFullProjectPaused, refetchChat, setLiveViewVisible]);

  useEffect(() => {
    if (!isFullProjectRunning && !buildStatus?.running) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/agents/full-project/status?projectId=${projectId}`);
        const data = await res.json();
        if (data.plan) setBuildStatus(data);
        if (!data.running && isFullProjectRunning) {
          setFullProjectRunning(false);
          setFullProjectPaused(false);
          refetchChat();
        }
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => clearInterval(t);
  }, [projectId, isFullProjectRunning, buildStatus?.running, setFullProjectRunning, setFullProjectPaused, refetchChat]);

  const sendDirectMessage = useCallback(
    async (agentName: string, message: string) => {
      console.log("[DirectChat] Sending direct message to:", agentName, "message:", message.slice(0, 50));
      const supabase = getClient();

      await supabase.from("chat_turns").insert({
        project_id: projectId,
        agent_name: "Boss",
        agent_title: "Boss",
        content: `@${agentName} ${message}`,
        turn_type: "direct_command",
      });

      setTypingAgents([agentName]);

      try {
        console.log("[DirectChat] Calling /api/agents/direct for:", agentName);
        const res = await fetch("/api/agents/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, agentName, message }),
        });

        if (!res.ok) {
          const err = await res.text();
          console.error("[DirectChat] Error response:", err);
          toast.error(`${agentName} error: ${err}`);
        } else {
          console.log("[DirectChat] Success from", agentName);
        }
      } catch (err) {
        toast.error(`Network error reaching ${agentName}`);
        console.error("[DirectChat] Network error:", err);
      } finally {
        setTypingAgents([]);
        await refetchChat();
      }
    },
    [projectId, refetchChat]
  );

  const handleExecuteCode = useCallback(
    async (code: string, agentName?: string) => {
      try {
        const res = await fetch("/api/ue5/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            code,
            agentName: agentName ?? "Thomas",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Failed to queue UE5 command");
          throw new Error(data.error);
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("Failed")) return;
        toast.error("Failed to send code to UE5");
        throw e;
      }
    },
    [projectId]
  );

  const sendBossCommand = useCallback(
    async (message: string, file?: File) => {
      console.log("[SendCommand] Raw message:", message);
      const direct = parseDirectMention(message);

      if (direct) {
        console.log("[SendCommand] Detected direct message to:", direct.agentName);
        await sendDirectMessage(direct.agentName, direct.cleanMessage);
        return;
      }

      const presetKey = detectGamePresetInPrompt(message);
      if (presetKey && gamePresets[presetKey]) {
        try {
          await handleExecuteCode(generatePresetCode(gamePresets[presetKey]), "Boss");
          toast.success(`Applied ${gamePresets[presetKey].name} style, then building.`);
        } catch {
          // toast already shown
        }
      }

      console.log("[SendCommand] Broadcasting to ALL agents");
      const supabase = getClient();
      let attachmentUrl: string | undefined;
      if (file) {
        const path = `${projectId}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("reference-images").upload(path, file, { cacheControl: "3600", upsert: false });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("reference-images").getPublicUrl(path);
          attachmentUrl = urlData.publicUrl;
        }
      }
      await supabase.from("chat_turns").insert({
        project_id: projectId,
        agent_name: "Boss",
        agent_title: "Boss",
        content: message,
        turn_type: "boss_command",
        ...(attachmentUrl && { attachment_url: attachmentUrl }),
      });

      await supabase.from("god_eye_log").insert({
        project_id: projectId,
        event_type: "boss",
        agent_name: "Boss",
        detail: `Boss command: ${message.slice(0, 100)}`,
      });

      setTypingAgents(TEAM.map((a) => a.name));

      try {
        const res = await fetch("/api/agents/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, bossMessage: message }),
        });

        if (!res.ok) {
          const err = await res.text();
          toast.error("Agent error: " + err);
        }
      } catch (err) {
        toast.error("Network error communicating with agents");
        console.error(err);
      } finally {
        setTypingAgents([]);
        await refetchChat();
      }
    },
    [projectId, refetchChat, sendDirectMessage, handleExecuteCode]
  );

  const handleRecreateImage = useCallback(
    async (imageUrl: string) => {
      try {
        const res = await fetch("/api/tools/image-analyze-from-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, imageUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Analysis failed");
        const analysis = data.analysis ?? "";
        const code = data.code ?? "";
        const content = code
          ? `**Image analysis:**\n\n${analysis}\n\n**Generated code:**\n\`\`\`python\n${code}\n\`\`\``
          : `**Image analysis:**\n\n${analysis}`;
        const supabase = getClient();
        await supabase.from("chat_turns").insert({
          project_id: projectId,
          agent_name: "Thomas",
          agent_title: "Programmer",
          content,
          turn_type: "execution",
        });
        await refetchChat();
        toast.success("Analysis complete. Use Send to UE5 on the code block to run in UE5.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Recreate failed");
      }
    },
    [projectId, refetchChat]
  );

  const sendToSpecificAgent = useCallback(
    (agentName: string) => {
      return async (message: string) => {
        await sendDirectMessage(agentName, message);
      };
    },
    [sendDirectMessage]
  );

  const runOneTurn = useCallback(async () => {
    setIsRunningTurn(true);
    setTypingAgents(TEAM.map((a) => a.name));
    try {
      const res = await fetch("/api/agents/route-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        toast.error("Failed to run turn");
      }
      await refetchChat();
    } catch {
      toast.error("Network error");
    } finally {
      setTypingAgents([]);
      setIsRunningTurn(false);
    }
  }, [projectId, refetchChat]);

  const startAutonomous = useCallback(() => {
    autonomousRef.current = true;
    setAutonomousRunning(true);
    toast.success("Autonomous mode started");

    const run = async () => {
      while (autonomousRef.current) {
        setTypingAgents(TEAM.map((a) => a.name));
        try {
          const res = await fetch("/api/agents/autonomous", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId }),
          });
          if (!res.ok) break;

          const data = await res.json();
          await refetchChat();
          if (data.done) {
            toast.info("All tasks completed");
            break;
          }
        } catch {
          break;
        }
        setTypingAgents([]);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setTypingAgents([]);
      autonomousRef.current = false;
      setAutonomousRunning(false);
    };

    run();
  }, [projectId, setAutonomousRunning, refetchChat]);

  const stopAutonomous = useCallback(() => {
    autonomousRef.current = false;
    setAutonomousRunning(false);
    setTypingAgents([]);
    toast.info("Autonomous mode stopped");
  }, [setAutonomousRunning]);

  const handleCaptureNow = useCallback(async () => {
    try {
      const res = await fetch("/api/ue5/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Screenshot requested. Relay will capture when ready.");
      } else {
        toast.error(data.error ?? "Capture failed");
      }
    } catch {
      toast.error("Capture failed");
    }
  }, [projectId]);

  const handleFullProjectStart = useCallback(async () => {
    if (!fullProjectPrompt.trim()) {
      toast.error("Enter a project prompt");
      return;
    }
    setFullProjectDialogOpen(false);
    setFullProjectRunning(true);
    setPipViewportVisible(true);
    const prompt = fullProjectPrompt.trim();
    setFullProjectPrompt("");
    try {
      const res = await fetch("/api/agents/full-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Full Project failed");
        return;
      }
      toast.success(data.summary ?? "Full Project complete");
    } catch (e) {
      toast.error("Full Project request failed");
      console.error(e);
    } finally {
      setFullProjectRunning(false);
      setFullProjectPaused(false);
      await refetchChat();
    }
  }, [projectId, fullProjectPrompt, setFullProjectRunning, setFullProjectPaused, setPipViewportVisible, refetchChat]);

  const handleFullProjectPause = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/full-project/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "pause" }),
      });
      if (res.ok) {
        toast.info("Project paused");
        setFullProjectPaused(true);
      }
    } catch {
      toast.error("Failed to pause");
    }
  }, [projectId, setFullProjectPaused]);

  const handleFullProjectResume = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/full-project/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "resume" }),
      });
      if (res.ok) {
        toast.info("Project resumed");
        setFullProjectPaused(false);
      }
    } catch {
      toast.error("Failed to resume");
    }
  }, [projectId, setFullProjectPaused]);

  const handleFullProjectStop = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/full-project/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "stop" }),
      });
      if (res.ok) {
        toast.info("Project stop requested");
        setFullProjectRunning(false);
        setFullProjectPaused(false);
      }
    } catch {
      toast.error("Failed to stop");
    }
  }, [projectId, setFullProjectRunning, setFullProjectPaused]);

  const handleFeedbackSubmit = useCallback(async () => {
    const msg = feedbackMessage.trim();
    if (!msg) return;
    setFeedbackOpen(false);
    setFeedbackMessage("");
    await sendBossCommand(msg);
  }, [feedbackMessage, sendBossCommand]);

  return (
    <>
      <Header projectName={project?.name ?? "Loading..."} />
      <div className="flex flex-1 overflow-hidden flex-col">
        {showBuildingView && (
          <div className="px-4 py-2 border-b border-boss-border bg-boss-surface/80 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  Building your game… {buildStatus?.totalTasks ? `Task ${(buildStatus.currentTaskIndex ?? 0) + 1}/${buildStatus.totalTasks}` : "Starting…"}
                </p>
                {buildStatus?.currentTaskTitle && (
                  <p className="text-xs text-text-muted truncate">{buildStatus.currentTaskTitle}</p>
                )}
                {(buildStatus?.totalTasks ?? 0) > 0 && (
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-boss-elevated overflow-hidden">
                    <div
                      className="h-full bg-agent-green rounded-full transition-all duration-500"
                      style={{ width: `${(((buildStatus?.currentTaskIndex ?? 0) + 1) / (buildStatus?.totalTasks || 1)) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {showBuildingView ? (
            <>
              <div className="flex-[0.6] flex flex-col min-w-0 border-r border-boss-border">
                <div className="flex-1 overflow-hidden flex flex-col">
                  <TeamChat onExecuteCode={handleExecuteCode} onRecreateImage={handleRecreateImage} typingAgents={typingAgents} />
                </div>
              </div>
              <div className="flex-[0.4] flex flex-col min-w-0 bg-boss-bg">
                {pixelStreamingConnected || isRelayConnected ? (
                  <PixelStreamingViewer
                    projectId={projectId}
                    signalingUrl={pixelStreamingUrl}
                    isConnected={pixelStreamingConnected}
                    refreshInterval={5}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-text-muted text-sm">
                    <p>Connect UE5 to see the viewport</p>
                    <Link href={`/project/${projectId}/settings`} className="text-agent-teal hover:underline text-xs mt-2">
                      Pixel Streaming setup
                    </Link>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col min-w-0">
              <div className="px-4 py-2 border-b border-boss-border flex items-center justify-between shrink-0">
                <ControlPanel
                  onRunOneTurn={runOneTurn}
                  onStartAutonomous={startAutonomous}
                  onStopAutonomous={stopAutonomous}
                  isRunningTurn={isRunningTurn}
                  onCaptureNow={handleCaptureNow}
                  onFullProjectClick={() => setFullProjectDialogOpen(true)}
                  onFullProjectPause={handleFullProjectPause}
                  onFullProjectResume={handleFullProjectResume}
                  onFullProjectStop={handleFullProjectStop}
                />
              </div>
              <TeamChat onExecuteCode={handleExecuteCode} onRecreateImage={handleRecreateImage} typingAgents={typingAgents} />
              <GodEyePanel />
              <div className="p-4 border-t border-boss-border bg-boss-surface/50 shrink-0">
                <CommandInput
                  onSend={sendBossCommand}
                  onSendDirect={sendToSpecificAgent}
                  disabled={isAutonomousRunning || isFullProjectRunning}
                  agentNames={AGENT_NAMES}
                />
              </div>
            </div>
          )}

          <AnimatePresence>
            {taskBoardVisible && <TaskBoard />}
          </AnimatePresence>
          {!showBuildingView && (
            <AnimatePresence>
              {liveViewVisible && (
                <div className="shrink-0 border-l border-boss-border w-[360px] flex flex-col overflow-hidden">
                  {pixelStreamingConnected || isRelayConnected ? (
                    <PixelStreamingViewer
                      projectId={projectId}
                      signalingUrl={pixelStreamingUrl}
                      isConnected={pixelStreamingConnected}
                      refreshInterval={5}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-text-muted text-sm">
                      <p className="mb-2">Connect UE5 to see the viewport</p>
                      <p className="text-xs mb-3">Run the relay and open this project in UE5, or set up Pixel Streaming.</p>
                      <Link
                        href={`/project/${projectId}/settings`}
                        className="text-agent-teal hover:underline text-xs"
                      >
                        Connect UE5 / Pixel Streaming setup
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </AnimatePresence>
          )}
          {pipViewportVisible && (
            <LiveViewport
              projectId={projectId}
              refreshInterval={5}
              pipMode
              onExpandFromPiP={() => {
                setPipViewportVisible(false);
                setLiveViewVisible(true);
              }}
              onClosePiP={() => setPipViewportVisible(false)}
            />
          )}
        </div>

        {showBuildingView && (
          <div className="px-4 py-3 border-t border-boss-border bg-boss-surface/80 flex items-center gap-2 shrink-0">
            {isFullProjectPaused ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleFullProjectResume}
                className="border-agent-green/30 text-agent-green hover:bg-agent-green/10 gap-1.5"
              >
                ▶️ Resume
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleFullProjectPause}
                className="border-agent-amber/30 text-agent-amber hover:bg-agent-amber/10 gap-1.5"
              >
                ⏸️ Pause
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleFullProjectStop}
              className="border-agent-rose/30 text-agent-rose hover:bg-agent-rose/10 gap-1.5"
            >
              ⏹️ Stop
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFeedbackOpen(true)}
              className="border-boss-border text-text-secondary hover:text-text-primary gap-1.5"
            >
              💬 Give Feedback
            </Button>
          </div>
        )}
      </div>

      <Dialog open={fullProjectDialogOpen} onOpenChange={setFullProjectDialogOpen}>
        <DialogContent className="bg-boss-surface border-boss-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-text-primary">🚀 Full Project</DialogTitle>
            <DialogDescription className="text-text-muted">
              Describe the full project. Nima will break it into tasks; each task will be executed in UE5 automatically. You can Pause or Stop at any time.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Build me a medieval castle with landscape, trees, lighting, and a dragon"
            value={fullProjectPrompt}
            onChange={(e) => setFullProjectPrompt(e.target.value)}
            className="min-h-24 bg-boss-elevated border-boss-border text-text-primary placeholder:text-text-muted"
            disabled={isFullProjectRunning}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFullProjectDialogOpen(false)} className="border-boss-border">
              Cancel
            </Button>
            <Button
              onClick={handleFullProjectStart}
              disabled={!fullProjectPrompt.trim() || isFullProjectRunning}
              className="bg-gold hover:bg-gold/90 text-black gap-1.5"
            >
              🚀 Start Full Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="bg-boss-surface border-boss-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-text-primary">💬 Give Feedback</DialogTitle>
            <DialogDescription className="text-text-muted">
              Send a message to the team while they build. They can adjust based on your feedback.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Make the castle bigger, add more trees..."
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
            className="min-h-20 bg-boss-elevated border-boss-border text-text-primary placeholder:text-text-muted"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackOpen(false)} className="border-boss-border">
              Cancel
            </Button>
            <Button onClick={handleFeedbackSubmit} disabled={!feedbackMessage.trim()} className="bg-gold hover:bg-gold/90 text-boss-bg gap-1.5">
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={imageTo3DModalOpen} onOpenChange={setImageTo3DModalOpen}>
        <DialogContent className="bg-boss-surface border-boss-border max-w-2xl p-0 overflow-hidden">
          <ImageTo3D projectId={projectId} onCodeGenerated={handleExecuteCode} />
        </DialogContent>
      </Dialog>
    </>
  );
}
