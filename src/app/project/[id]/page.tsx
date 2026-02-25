"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { CommandInput } from "@/components/boss/CommandInput";
import { ControlPanel } from "@/components/boss/ControlPanel";
import { TeamChat } from "@/components/team/TeamChat";
import BuildProgressPanel, { type BuildTask } from "@/components/build/BuildProgressPanel";
import SmartBuildView from "@/components/build/SmartBuildView";
import { GodEyePanel } from "@/components/god-eye/GodEyePanel";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import LiveViewport from "@/components/tools/LiveViewport";
import PixelStreamingViewer from "@/components/tools/PixelStreamingViewer";
import { ImageTo3D } from "@/components/tools/ImageTo3D";
import Link from "next/link";
import { useProjectStore } from "@/lib/stores/projectStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { getClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/collaboration/user";
import { subscribeToPresence, presenceStateToUsers, type PresenceUser } from "@/lib/collaboration/presence";
import type { ChatTurn } from "@/lib/agents/types";
import { detectGamePresetInPrompt, gamePresets, generatePresetCode } from "@/lib/gameDNA/presets";
import { extractPythonCode } from "@/lib/ue5/extractPythonCode";
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
  const { setAutonomousRunning, isAutonomousRunning, setChatTurns, setFullProjectRunning, isFullProjectRunning, isFullProjectPaused, setFullProjectPaused, isRelayConnected, ue5Commands } = useProjectStore();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [pixelStreamingUrl, setPixelStreamingUrl] = useState<string | null>(null);
  const [pixelStreamingConnected, setPixelStreamingConnected] = useState(false);
  const [isRunningTurn, setIsRunningTurn] = useState(false);
  const [typingAgents, setTypingAgents] = useState<string[]>([]);
  const [buildStatus, setBuildStatus] = useState<FullProjectStatus | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [streamingAgent, setStreamingAgent] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const autonomousRef = useRef(false);
  const autoBuildStartedRef = useRef(false);
  const [smartBuildFinished, setSmartBuildFinished] = useState(false);
  const buildParam = searchParams.get("build") === "1";
  const showSmartBuildView = buildParam && !!project?.initial_prompt && !smartBuildFinished;
  const showBuildingView = isFullProjectRunning || (buildStatus?.running ?? false);

  useEffect(() => {
    const { userEmail, userName } = getCurrentUser();
    if (!projectId || (!userEmail && !userName)) return;
    const channel = subscribeToPresence(projectId, userEmail || "anonymous", userName || "Boss", {
      onSync: (state) => setOnlineUsers(presenceStateToUsers(state)),
      onJoin: (user) => toast.info(`${user.user_name || user.user_email} joined the project`),
      onLeave: (user) => toast.info(`${user.user_name || user.user_email} left`),
    });
    return () => {
      channel.unsubscribe();
    };
  }, [projectId]);

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
    setSmartBuildFinished(false);
    setLiveViewVisible?.(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("autoBuild");
    params.set("build", "1");
    router.replace(`/project/${projectId}?${params.toString()}`, { scroll: false });
  }, [project?.id, project?.initial_prompt, autoBuild, projectId, searchParams, router, setLiveViewVisible]);

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

  const handleExecuteCode = useCallback(
    async (code: string, agentName?: string) => {
      const { userEmail, userName } = getCurrentUser();
      try {
        const res = await fetch("/api/ue5/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            code,
            agentName: agentName ?? "Thomas",
            ...(userEmail && { submittedByEmail: userEmail }),
            ...(userName && { submittedByName: userName }),
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
      console.log("[SEND] projectId:", projectId, "message length:", message?.length);
      const presetKey = detectGamePresetInPrompt(message);
      if (presetKey && gamePresets[presetKey]) {
        try {
          await handleExecuteCode(generatePresetCode(gamePresets[presetKey]), "Boss");
          toast.success(`Applied ${gamePresets[presetKey].name} style.`);
        } catch {
          // toast already shown
        }
        return;
      }

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
      const { userEmail, userName } = getCurrentUser();
      await supabase.from("chat_turns").insert({
        project_id: projectId,
        agent_name: "Boss",
        agent_title: "Boss",
        content: message,
        turn_type: "boss_command",
        ...(attachmentUrl && { attachment_url: attachmentUrl }),
        ...(userEmail && { user_email: userEmail }),
        ...(userName && { user_name: userName }),
      });

      await supabase.from("god_eye_log").insert({
        project_id: projectId,
        event_type: "boss",
        agent_name: "Boss",
        detail: `Boss command: ${message.slice(0, 100)}`,
        ...(userEmail && { user_email: userEmail }),
        ...(userName && { user_name: userName }),
      });

      setStreamingAgent("Grand Studio");
      setStreamingContent("");

      try {
        const streamRes = await fetch("/api/build/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: message.trim() }),
        });

        if (!streamRes.ok) {
          const errText = await streamRes.text();
          let errMessage = "Build request failed";
          try {
            const parsed = JSON.parse(errText) as { error?: string };
            if (parsed?.error) errMessage = parsed.error;
          } catch {
            if (errText && errText.length < 200) errMessage = errText;
          }
          console.error("[SEND] Stream error:", streamRes.status, errMessage);
          setStreamingAgent(null);
          setStreamingContent("");
          toast.error(errMessage);
          await refetchChat();
          return;
        }

        const reader = streamRes.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) {
          setStreamingAgent(null);
          setStreamingContent("");
          toast.error("No response body from build stream");
          await refetchChat();
          return;
        }

        let content = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (typeof delta === "string") {
                content += delta;
                setStreamingContent(content);
              }
            } catch {
              /* ignore */
            }
          }
        }

        setStreamingAgent(null);
        setStreamingContent("");

        let finalContent = content;
        if (!extractPythonCode(content)) {
          toast.info("No code in response, retrying with stronger prompt…");
          setStreamingAgent("Grand Studio");
          setStreamingContent("");
          const retryRes = await fetch("/api/build/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: `You MUST write Python code for this request. Output ONLY a \`\`\`python code block, nothing else:\n\n${message.trim()}`,
            }),
          });
          if (retryRes.ok && retryRes.body) {
            const reader = retryRes.body.getReader();
            const decoder = new TextDecoder();
            let retryContent = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6);
                if (data === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
                  const delta = parsed.choices?.[0]?.delta?.content;
                  if (typeof delta === "string") retryContent += delta;
                } catch {
                  /* ignore */
                }
              }
            }
            setStreamingAgent(null);
            setStreamingContent("");
            if (extractPythonCode(retryContent)) finalContent = retryContent;
          }
        }

        if (!extractPythonCode(finalContent)) {
          toast.error("No valid Python code in response. Try asking to \"write code\" or \"build\" something.");
          await refetchChat();
          return;
        }

        const execRes = await fetch("/api/build/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, rawResponse: finalContent }),
        });
        const execData = await execRes.json();

        if (!execRes.ok || !execData.commandId) {
          const execErr = (execData as { error?: string }).error ?? "Failed to execute code";
          console.error("[SEND] Execute error:", execErr);
          toast.error(execErr);
          await refetchChat();
          return;
        }

        const commandId = execData.commandId as string;
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const statusRes = await fetch(`/api/build/status?commandId=${encodeURIComponent(commandId)}`);
          const cmd = statusRes.ok ? await statusRes.json() : null;
          if (cmd?.status === "success") {
            toast.success("Built successfully!");
            await refetchChat();
            return;
          }
          if (cmd?.status === "error") {
            toast.error(cmd.error_log ?? "Execution failed");
            await refetchChat();
            return;
          }
        }
        toast.error("Execution timeout");
        await refetchChat();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[SEND] Build error:", msg);
        setStreamingAgent(null);
        setStreamingContent("");
        toast.error(msg || "Build failed");
        await refetchChat();
      }
    },
    [projectId, refetchChat, handleExecuteCode]
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
          agent_name: "Grand Studio",
          agent_title: "Grand Studio",
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

  const handleFixCritical = useCallback(
    async (issues: string[]) => {
      await sendBossCommand("Fix these critical issues from the playtest:\n\n" + issues.join("\n"));
    },
    [sendBossCommand]
  );

  const handleRunPlaytest = useCallback(async () => {
    try {
      await fetch("/api/ue5/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      toast.info("Capturing screenshot…");
      const supabase = getClient();
      const deadline = Date.now() + 30000;
      let screenshotUrl: string | null = null;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const { data } = await supabase
          .from("ue5_commands")
          .select("screenshot_url")
          .eq("project_id", projectId)
          .not("screenshot_url", "is", null)
          .order("executed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.screenshot_url) {
          screenshotUrl = data.screenshot_url as string;
          break;
        }
      }
      const res = await fetch("/api/agents/playtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, screenshotUrl: screenshotUrl ?? undefined, focusArea: "all" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Playtest failed");
      await refetchChat();
      toast.success("Playtest complete. See Amir's report above.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Playtest failed");
    }
  }, [projectId, refetchChat]);

  const runPlaytestTrigger = useUIStore((s) => s.runPlaytestTrigger);
  const setRunPlaytestTrigger = useUIStore((s) => s.setRunPlaytestTrigger);
  useEffect(() => {
    if (runPlaytestTrigger > 0) {
      setRunPlaytestTrigger(0);
      handleRunPlaytest();
    }
  }, [runPlaytestTrigger, setRunPlaytestTrigger, handleRunPlaytest]);


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

  const handleSmartBuildDone = useCallback(
    (success: boolean, errorMessage?: string) => {
      setSmartBuildFinished(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("build");
      router.replace(`/project/${projectId}${params.toString() ? `?${params}` : ""}`, { scroll: false });
      refetchChat();
      if (success) toast.success("Build complete!");
      else if (!errorMessage) toast.error("Build failed or stopped.");
    },
    [projectId, searchParams, router, refetchChat]
  );

  return (
    <>
      <Header
        projectName={project?.name ?? "Loading..."}
        onlineUsers={onlineUsers}
        executingCommand={ue5Commands.find((c) => c.status === "executing")}
      />
      <div className="flex flex-1 overflow-hidden flex-col">
        {showBuildingView && (
          <div className="shrink-0 h-[280px] border-b border-boss-border flex">
            <BuildProgressPanel
              projectId={projectId}
              tasks={(() => {
                const plan = buildStatus?.plan ?? [];
                const currentIndex = buildStatus?.currentTaskIndex ?? 0;
                return plan.map((t: { id?: string; title: string; status: string; assignedTo?: string; startedAt?: number; completedAt?: number }, i: number) => ({
                  id: t.id ?? `task-${i}`,
                  title: t.title,
                  assignedTo: t.assignedTo,
                  status: (t.status === "in_progress" && i === currentIndex ? "running" : t.status === "failed" ? "error" : t.status) as BuildTask["status"],
                  startedAt: t.startedAt,
                  completedAt: t.completedAt,
                }));
              })()}
              isBuilding={buildStatus?.running ?? false}
              currentCode=""
              currentTaskTitle={buildStatus?.currentTaskTitle ?? null}
              onPause={handleFullProjectPause}
              onStop={handleFullProjectStop}
              onFeedback={() => setFeedbackOpen(true)}
            />
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {showSmartBuildView ? (
            <>
              <div className="flex-[0.5] flex flex-col min-w-0 border-r border-boss-border overflow-hidden">
                <SmartBuildView
                  projectId={projectId}
                  prompt={(project?.initial_prompt as string) ?? ""}
                  onDone={handleSmartBuildDone}
                  onStop={() => handleSmartBuildDone(false)}
                />
              </div>
              <div className="flex-[0.5] flex flex-col min-w-0 bg-boss-bg">
                {pixelStreamingConnected || isRelayConnected ? (
                  <PixelStreamingViewer
                    projectId={projectId}
                    signalingUrl={pixelStreamingUrl}
                    isConnected={pixelStreamingConnected}
                    refreshInterval={5}
                  />
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-text-muted text-sm">
                    <p>Connect UE5 to see the viewport</p>
                    <Link href={`/project/${projectId}/settings`} className="text-agent-teal hover:underline text-xs mt-2">
                      Pixel Streaming setup
                    </Link>
                  </div>
                )}
              </div>
            </>
          ) : showBuildingView ? (
            <>
              <div className="flex-[0.6] flex flex-col min-w-0 border-r border-boss-border">
                <div className="flex-1 overflow-hidden flex flex-col">
                  <TeamChat onExecuteCode={handleExecuteCode} onRecreateImage={handleRecreateImage} onFixCritical={handleFixCritical} onRunPlaytest={handleRunPlaytest} typingAgents={typingAgents} streamingAgent={streamingAgent} streamingContent={streamingContent} />
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
                  onCaptureNow={handleCaptureNow}
                  onRunPlaytest={handleRunPlaytest}
                />
              </div>
              <TeamChat onExecuteCode={handleExecuteCode} onRecreateImage={handleRecreateImage} onFixCritical={handleFixCritical} onRunPlaytest={handleRunPlaytest} typingAgents={typingAgents} streamingAgent={streamingAgent} streamingContent={streamingContent} />
              <GodEyePanel />
              <div className="p-4 border-t border-boss-border bg-boss-surface/50 shrink-0">
                <CommandInput
                  onSend={sendBossCommand}
                  disabled={isAutonomousRunning || isFullProjectRunning}
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

      </div>

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
