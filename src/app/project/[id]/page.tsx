"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  ChevronLeft,
  Settings,
  Sparkles,
  Camera,
} from "lucide-react";
import { useProjectStore } from "@/lib/stores/projectStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { getClient } from "@/lib/supabase/client";
import type { ChatTurn, UE5Command } from "@/lib/types";
import type { AssetEntry } from "@/lib/ue5/assetLibrary";
import { extractPythonCode } from "@/lib/ue5/extractPythonCode";
import { getTemplateForPrompt } from "@/lib/ue5/sceneTemplates";

import { AICopilotPanel } from "@/components/workspace/AICopilotPanel";
import { WorkspacePanel } from "@/components/workspace/WorkspacePanel";
import { ViewportPanel } from "@/components/workspace/ViewportPanel";
import SmartBuildView from "@/components/build/SmartBuildView";
import BuildProgressPanel, { type BuildTask } from "@/components/build/BuildProgressPanel";
import { ImageTo3D } from "@/components/tools/ImageTo3D";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

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
  const {
    imageTo3DModalOpen,
    setImageTo3DModalOpen,
    setChatPresetMessage,
  } = useUIStore();
  const {
    chatTurns,
    setChatTurns,
    setFullProjectRunning,
    isFullProjectRunning,
    setFullProjectPaused,
    isRelayConnected,
    ue5Commands,
    godEyeLog,
  } = useProjectStore();

  const [copilotOpen, setCopilotOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [buildStatus, setBuildStatus] = useState<FullProjectStatus | null>(null);
  const [smartBuildFinished, setSmartBuildFinished] = useState(false);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [projectName, setProjectName] = useState("");

  const autoBuildStartedRef = useRef(false);
  const seenSuccessIdsRef = useRef<Set<string>>(new Set());
  const isFirstCommandLoadRef = useRef(true);
  const autoCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildParam = searchParams.get("build") === "1";
  const showSmartBuildView = buildParam && !!project?.initial_prompt && !smartBuildFinished;
  const showBuildingView = isFullProjectRunning || (buildStatus?.running ?? false);

  useEffect(() => {
    if (project?.name) setProjectName(project.name);
  }, [project?.name]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCopilotOpen((v) => !v);
      }
      if (e.key === "Escape" && copilotOpen) {
        setCopilotOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
        e.preventDefault();
        handleCaptureNow();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [copilotOpen]);

  // Refetch chat
  const refetchChat = useCallback(async () => {
    const supabase = getClient();
    const { data } = await supabase
      .from("chat_turns")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (data) setChatTurns(data as ChatTurn[]);
  }, [projectId, setChatTurns]);

  // Auto-build on initial load
  const autoBuild = searchParams.get("autoBuild") === "1";
  useEffect(() => {
    if (!project?.id || !project?.initial_prompt || !autoBuild || autoBuildStartedRef.current) return;
    autoBuildStartedRef.current = true;
    setSmartBuildFinished(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("autoBuild");
    params.set("build", "1");
    router.replace(`/project/${projectId}?${params.toString()}`, { scroll: false });
  }, [project?.id, project?.initial_prompt, autoBuild, projectId, searchParams, router]);

  // Poll build status
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
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(t);
  }, [projectId, isFullProjectRunning, buildStatus?.running, setFullProjectRunning, setFullProjectPaused, refetchChat]);

  // Auto-capture on successful commands
  useEffect(() => {
    if (isFirstCommandLoadRef.current) {
      if (ue5Commands.length > 0) {
        for (const c of ue5Commands) {
          if (c.status === "success") seenSuccessIdsRef.current.add(c.id);
        }
        isFirstCommandLoadRef.current = false;
      }
      return;
    }
    const newSuccesses = ue5Commands.filter(
      (c) => c.status === "success" && !seenSuccessIdsRef.current.has(c.id)
    );
    if (newSuccesses.length === 0) return;
    for (const c of newSuccesses) seenSuccessIdsRef.current.add(c.id);
    if (autoCaptureTimerRef.current) clearTimeout(autoCaptureTimerRef.current);
    autoCaptureTimerRef.current = setTimeout(async () => {
      toast.info("Capturing scene screenshot...");
      try {
        await fetch("/api/ue5/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
      } catch { /* ignore */ }
    }, 3000);
    return () => {
      if (autoCaptureTimerRef.current) clearTimeout(autoCaptureTimerRef.current);
    };
  }, [ue5Commands, projectId]);

  // Latest screenshot
  const { latestScreenshot, latestScreenshotTime, latestVisionScore } = useMemo(() => {
    let url: string | null = null;
    let time: string | null = null;
    let score: number | null = null;
    let latestMs = 0;
    for (const cmd of ue5Commands) {
      if (cmd.screenshot_url) {
        const t = new Date(cmd.executed_at ?? cmd.created_at).getTime();
        if (t > latestMs) {
          latestMs = t;
          url = cmd.screenshot_url;
          time = cmd.executed_at ?? cmd.created_at;
        }
      }
    }
    for (const turn of chatTurns) {
      if (turn.screenshot_url) {
        const t = new Date(turn.created_at).getTime();
        if (t > latestMs) {
          latestMs = t;
          url = turn.screenshot_url;
          time = turn.created_at;
        }
      }
    }
    return { latestScreenshot: url, latestScreenshotTime: time, latestVisionScore: score };
  }, [ue5Commands, chatTurns]);

  // Build status for top bar
  const currentStatus = useMemo(() => {
    const executing = ue5Commands.some((c: UE5Command) => c.status === "executing");
    if (executing) return { label: "Executing in UE5...", color: "bg-[#00BCD4]", pulse: true };
    if (isGenerating) return { label: "AI Generating Code...", color: "bg-[#2196F3]", pulse: true };
    if (isFullProjectRunning) return { label: "AI Generating Code...", color: "bg-[#2196F3]", pulse: true };
    const lastCmd = ue5Commands.length > 0 ? ue5Commands[ue5Commands.length - 1] : null;
    if (lastCmd?.status === "error") return { label: "Build Failed", color: "bg-red-500", pulse: false };
    if (lastCmd?.status === "success") return { label: "Build Complete", color: "bg-emerald-500", pulse: false };
    return { label: "Ready", color: "bg-[#606068]", pulse: false };
  }, [ue5Commands, isGenerating, isFullProjectRunning]);

  // Capture screenshot
  const handleCaptureNow = useCallback(async () => {
    try {
      const res = await fetch("/api/ue5/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (res.ok) toast.success("Screenshot requested.");
      else toast.error(data.error ?? "Capture failed");
    } catch { toast.error("Capture failed"); }
  }, [projectId]);

  // Execute code
  const handleExecuteCode = useCallback(
    async (code: string, agentName?: string) => {
      try {
        const res = await fetch("/api/ue5/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, code, agentName: agentName ?? "Grand Studio" }),
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

  // Vision loop
  const runVisionLoop = useCallback(
    async (projId: string, originalPrompt: string) => {
      const MAX_ITERATIONS = 2;
      for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        await new Promise((r) => setTimeout(r, 3000));
        toast.info(`Capturing scene (${iter + 1}/${MAX_ITERATIONS})...`);
        const ssRes = await fetch("/api/build/screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: projId }),
        });
        const ssData = await ssRes.json();
        if (!ssRes.ok || !ssData.commandId) continue;
        const ssCommandId = ssData.commandId as string;
        await new Promise((r) => setTimeout(r, 5000));
        let screenshotUrl: string | null = null;
        for (let p = 0; p < 8; p++) {
          await new Promise((r) => setTimeout(r, 2000));
          const statusRes = await fetch(`/api/build/status?commandId=${encodeURIComponent(ssCommandId)}`);
          const statusData = statusRes.ok ? await statusRes.json() : null;
          if (statusData?.status === "success" && statusData?.screenshot_url) {
            screenshotUrl = statusData.screenshot_url;
            break;
          }
          if (statusData?.status === "error") break;
        }
        if (!screenshotUrl) { toast.warning("Could not capture screenshot"); break; }
        let screenshotBase64: string;
        try {
          const imgRes = await fetch(screenshotUrl);
          const blob = await imgRes.blob();
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          screenshotBase64 = btoa(binary);
        } catch { toast.warning("Could not load screenshot"); break; }
        toast.info("AI evaluating scene...");
        const evalRes = await fetch("/api/build/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ screenshotBase64, originalPrompt, projectId: projId }),
        });
        const evalData = await evalRes.json();
        if (!evalRes.ok || !evalData.evaluation) break;
        const evaluation = evalData.evaluation as string;
        if (/APPROVED|SCORE:\s*(8|9|10)/i.test(evaluation) || /score.*[89]|10/i.test(evaluation)) {
          toast.success("Scene approved by AI");
          return;
        }
        const fixCode = extractPythonCode(evaluation);
        if (!fixCode) break;
        toast.info("Applying fixes...");
        const fixExecRes = await fetch("/api/build/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: projId, rawResponse: evaluation }),
        });
        const fixExecData = await fixExecRes.json();
        if (!fixExecRes.ok || !fixExecData.commandId) break;
        await new Promise((r) => setTimeout(r, 5000));
      }
    },
    []
  );

  // Send message to AI
  const sendMessage = useCallback(
    async (message: string) => {
      const supabase = getClient();
      await supabase.from("chat_turns").insert({
        project_id: projectId,
        agent_name: "Boss",
        agent_title: "Boss",
        content: message,
        turn_type: "boss_command",
      });
      await supabase.from("god_eye_log").insert({
        project_id: projectId,
        event_type: "boss",
        agent_name: "Boss",
        detail: `Command: ${message.slice(0, 100)}`,
      });

      setIsGenerating(true);
      setStreamingContent("");

      const template = getTemplateForPrompt(message);
      if (template) {
        try {
          setStreamingContent(`Using ${template.name} template...`);
          const templateRaw = `Using ${template.name} template.\n\n\`\`\`python\n${template.code}\n\`\`\``;
          const execRes = await fetch("/api/build/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, rawResponse: templateRaw }),
          });
          const execData = await execRes.json();
          if (!execRes.ok || !execData.commandId) {
            toast.error((execData as { error?: string }).error ?? "Template execute failed");
            setIsGenerating(false);
            setStreamingContent("");
            await refetchChat();
            return;
          }
          const commandId = execData.commandId as string;
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const statusRes = await fetch(`/api/build/status?commandId=${encodeURIComponent(commandId)}`);
            const cmd = statusRes.ok ? await statusRes.json() : null;
            if (cmd?.status === "success") {
              toast.success(`Built with ${template.name} template!`);
              await runVisionLoop(projectId, message);
              setIsGenerating(false);
              setStreamingContent("");
              await refetchChat();
              return;
            }
            if (cmd?.status === "error") {
              toast.error(cmd.error_log ?? "Execution failed");
              setIsGenerating(false);
              setStreamingContent("");
              await refetchChat();
              return;
            }
          }
          toast.error("Execution timeout");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Template build failed");
        }
        setIsGenerating(false);
        setStreamingContent("");
        await refetchChat();
        return;
      }

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
          setIsGenerating(false);
          setStreamingContent("");
          toast.error(errMessage);
          await refetchChat();
          return;
        }
        const reader = streamRes.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) {
          setIsGenerating(false);
          setStreamingContent("");
          toast.error("No response body");
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
            } catch { /* ignore */ }
          }
        }
        setIsGenerating(false);
        setStreamingContent("");

        let finalContent = content;
        if (!extractPythonCode(content)) {
          toast.info("No code in response, retrying...");
          setIsGenerating(true);
          setStreamingContent("");
          const retryRes = await fetch("/api/build/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: `You MUST write Python code for this request. Output ONLY a \`\`\`python code block:\n\n${message.trim()}`,
            }),
          });
          if (retryRes.ok && retryRes.body) {
            const rReader = retryRes.body.getReader();
            const rDecoder = new TextDecoder();
            let retryContent = "";
            while (true) {
              const { done, value } = await rReader.read();
              if (done) break;
              const chunk = rDecoder.decode(value, { stream: true });
              for (const line of chunk.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6);
                if (data === "[DONE]") continue;
                try {
                  const p = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
                  const d = p.choices?.[0]?.delta?.content;
                  if (typeof d === "string") retryContent += d;
                } catch { /* ignore */ }
              }
            }
            setIsGenerating(false);
            setStreamingContent("");
            if (extractPythonCode(retryContent)) finalContent = retryContent;
          }
        }
        if (!extractPythonCode(finalContent)) {
          toast.error("No valid Python code in response.");
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
          toast.error((execData as { error?: string }).error ?? "Failed to execute code");
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
            await runVisionLoop(projectId, message);
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
        setIsGenerating(false);
        setStreamingContent("");
        toast.error(msg || "Build failed");
        await refetchChat();
      }
    },
    [projectId, refetchChat, runVisionLoop]
  );

  // Full project controls
  const handleFullProjectPause = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/full-project/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "pause" }),
      });
      if (res.ok) { toast.info("Project paused"); setFullProjectPaused(true); }
    } catch { toast.error("Failed to pause"); }
  }, [projectId, setFullProjectPaused]);

  const handleFullProjectStop = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/full-project/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "stop" }),
      });
      if (res.ok) { toast.info("Project stopped"); setFullProjectRunning(false); setFullProjectPaused(false); }
    } catch { toast.error("Failed to stop"); }
  }, [projectId, setFullProjectRunning, setFullProjectPaused]);

  const handleSmartBuildDone = useCallback(
    (success: boolean) => {
      setSmartBuildFinished(true);
      const p = new URLSearchParams(searchParams.toString());
      p.delete("build");
      router.replace(`/project/${projectId}${p.toString() ? `?${p}` : ""}`, { scroll: false });
      refetchChat();
      if (success) toast.success("Build complete!");
    },
    [projectId, searchParams, router, refetchChat]
  );

  // Asset click opens AI with prefill
  const handleAssetClick = useCallback((asset: AssetEntry) => {
    if (!asset.path) {
      setCopilotOpen(true);
      return;
    }
    setPrefillMessage(`Place a ${asset.name} in my scene`);
    setCopilotOpen(true);
  }, []);

  // Template click opens AI with prefill
  const handleTemplateClick = useCallback((name: string) => {
    setPrefillMessage(`Build a ${name}`);
    setCopilotOpen(true);
  }, []);

  // Clear scene
  const handleClearScene = useCallback(async () => {
    setPrefillMessage("Clear the entire scene - remove all objects");
    setCopilotOpen(true);
  }, []);

  // Save project name
  const handleSaveName = useCallback(async () => {
    if (!projectName.trim()) return;
    setEditingName(false);
    const supabase = getClient();
    await supabase.from("projects").update({ name: projectName.trim() }).eq("id", projectId);
  }, [projectId, projectName]);

  // ---- SmartBuild overlay ----
  if (showSmartBuildView) {
    return (
      <div className="flex flex-col h-full">
        <SmartBuildView
          projectId={projectId}
          prompt={(project?.initial_prompt as string) ?? ""}
          onDone={handleSmartBuildDone}
          onStop={() => handleSmartBuildDone(false)}
        />
      </div>
    );
  }

  return (
    <>
      {/* ================================================================ */}
      {/* TOP BAR                                                          */}
      {/* ================================================================ */}
      <div className="h-14 bg-[#111114] border-b border-white/5 flex items-center justify-between px-4 shrink-0 z-30">
        {/* Left */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-[#606068] hover:text-white transition p-1">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          {editingName ? (
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              className="text-lg font-semibold text-white bg-transparent border-b border-[#2196F3] outline-none px-1"
              autoFocus
            />
          ) : (
            <h1
              className="text-lg font-semibold text-white cursor-pointer hover:text-[#2196F3] transition"
              onDoubleClick={() => setEditingName(true)}
              title="Double-click to rename"
            >
              {projectName || "Untitled Project"}
            </h1>
          )}
          <span className="text-xs bg-[#2196F3]/10 text-[#2196F3] rounded px-2 py-0.5 font-medium">
            UE5 Project
          </span>
        </div>

        {/* Center — Build Status */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${currentStatus.color} ${
              currentStatus.pulse ? "animate-pulse" : ""
            }`}
          />
          <span className="text-sm text-[#A0A0A8]">{currentStatus.label}</span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg ${
            isRelayConnected ? "bg-emerald-500/10" : "bg-red-500/10"
          }`}>
            <span className={`w-2 h-2 rounded-full ${isRelayConnected ? "bg-emerald-500" : "bg-red-500"}`} />
            <span className={`text-xs ${isRelayConnected ? "text-emerald-400" : "text-red-400"}`}>
              {isRelayConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <Link
            href={`/project/${projectId}/settings`}
            className="p-2 rounded-lg text-[#606068] hover:text-white hover:bg-white/5 transition"
          >
            <Settings className="w-4 h-4" />
          </Link>

          {/* AI Co-Pilot Button */}
          <button
            onClick={() => setCopilotOpen(!copilotOpen)}
            className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all ${
              copilotOpen
                ? "bg-gradient-to-r from-[#2196F3] to-[#00BCD4] ring-2 ring-[#2196F3]/50 ring-offset-2 ring-offset-[#111114]"
                : "bg-gradient-to-r from-[#2196F3] to-[#00BCD4] shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
            } ${isGenerating ? "animate-pulse" : ""}`}
            title="AI Co-Pilot (Ctrl+K)"
          >
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* BUILD PROGRESS (when full-project is running)                    */}
      {/* ================================================================ */}
      {showBuildingView && (
        <div className="shrink-0 h-[200px] border-b border-white/5">
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
            onFeedback={() => {
              setCopilotOpen(true);
            }}
          />
        </div>
      )}

      {/* ================================================================ */}
      {/* MAIN WORKSPACE                                                   */}
      {/* ================================================================ */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left: Asset Library / Workspace */}
        <div className="w-[55%] min-w-0 shrink-0">
          <WorkspacePanel
            ue5Commands={ue5Commands}
            godEyeLog={godEyeLog}
            onAssetClick={handleAssetClick}
            onTemplateClick={handleTemplateClick}
            onClearScene={handleClearScene}
          />
        </div>

        {/* Right: Viewport Preview */}
        <div className="flex-1 min-w-0">
          <ViewportPanel
            screenshotUrl={latestScreenshot}
            screenshotTime={latestScreenshotTime}
            visionScore={latestVisionScore}
            onCapture={handleCaptureNow}
          />
        </div>
      </div>

      {/* ================================================================ */}
      {/* BOTTOM STATUS BAR                                                */}
      {/* ================================================================ */}
      <div className="h-8 shrink-0 bg-[#0A0A0B] border-t border-white/5 flex items-center justify-between px-4 text-xs text-[#606068]">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isRelayConnected ? "bg-emerald-500" : "bg-red-500"}`} />
          {isRelayConnected ? "Relay Connected" : "Disconnected"}
        </div>
        <div>{currentStatus.label}</div>
        <div>
          Builds: {ue5Commands.length}
          {ue5Commands.length > 0 && (() => {
            const last = ue5Commands[ue5Commands.length - 1];
            const ago = Math.round((Date.now() - new Date(last.created_at).getTime()) / 1000);
            return ` | Last: ${ago < 60 ? `${ago}s` : `${Math.round(ago / 60)}m`} ago`;
          })()}
        </div>
      </div>

      {/* ================================================================ */}
      {/* AI CO-PILOT FLOATING PANEL                                       */}
      {/* ================================================================ */}
      <AICopilotPanel
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        chatTurns={chatTurns}
        isGenerating={isGenerating}
        streamingContent={streamingContent}
        onSend={sendMessage}
        disabled={isGenerating || isFullProjectRunning}
        prefillMessage={prefillMessage}
        onClearPrefill={() => setPrefillMessage(null)}
      />

      {/* Image-to-3D Modal */}
      <Dialog open={imageTo3DModalOpen} onOpenChange={setImageTo3DModalOpen}>
        <DialogContent className="bg-[#111114] border-[#2A2A30] max-w-2xl p-0 overflow-hidden">
          <ImageTo3D projectId={projectId} onCodeGenerated={handleExecuteCode} />
        </DialogContent>
      </Dialog>
    </>
  );
}
