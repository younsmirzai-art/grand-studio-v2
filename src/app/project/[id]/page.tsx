"use client";

import { useCallback, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { CommandInput } from "@/components/boss/CommandInput";
import { ControlPanel } from "@/components/boss/ControlPanel";
import { TeamChat } from "@/components/team/TeamChat";
import { GodEyePanel } from "@/components/god-eye/GodEyePanel";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { LiveViewPanel } from "@/components/ue5/LiveViewPanel";
import { useProjectStore } from "@/lib/stores/projectStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { getClient } from "@/lib/supabase/client";
import { TEAM } from "@/lib/agents/identity";
import type { ChatTurn } from "@/lib/agents/types";
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

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const project = useProjectStore((s) => s.project);
  const { taskBoardVisible } = useUIStore();
  const { setAutonomousRunning, isAutonomousRunning, setChatTurns, setFullProjectRunning, isFullProjectRunning, setFullProjectPaused } = useProjectStore();
  const [isRunningTurn, setIsRunningTurn] = useState(false);
  const [typingAgents, setTypingAgents] = useState<string[]>([]);
  const [fullProjectDialogOpen, setFullProjectDialogOpen] = useState(false);
  const [fullProjectPrompt, setFullProjectPrompt] = useState("");
  const autonomousRef = useRef(false);

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

  const sendBossCommand = useCallback(
    async (message: string) => {
      console.log("[SendCommand] Raw message:", message);
      const direct = parseDirectMention(message);

      if (direct) {
        console.log("[SendCommand] Detected direct message to:", direct.agentName);
        await sendDirectMessage(direct.agentName, direct.cleanMessage);
        return;
      }

      console.log("[SendCommand] Broadcasting to ALL agents");
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
    [projectId, refetchChat, sendDirectMessage]
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
        // Success toast shown by ChatMessage after confirm
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("Failed")) return;
        toast.error("Failed to send code to UE5");
        throw e;
      }
    },
    [projectId]
  );

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

  const { liveViewVisible } = useUIStore();

  const handleFullProjectStart = useCallback(async () => {
    if (!fullProjectPrompt.trim()) {
      toast.error("Enter a project prompt");
      return;
    }
    setFullProjectDialogOpen(false);
    setFullProjectRunning(true);
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
  }, [projectId, fullProjectPrompt, setFullProjectRunning, setFullProjectPaused, refetchChat]);

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

  return (
    <>
      <Header projectName={project?.name ?? "Loading..."} />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-2 border-b border-boss-border flex items-center justify-between">
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

          <TeamChat
            onExecuteCode={handleExecuteCode}
            typingAgents={typingAgents}
          />

          <GodEyePanel />

          <div className="p-4 border-t border-boss-border bg-boss-surface/50">
            <CommandInput
              onSend={sendBossCommand}
              onSendDirect={sendToSpecificAgent}
              disabled={isAutonomousRunning || isFullProjectRunning}
              agentNames={AGENT_NAMES}
            />
          </div>
        </div>

        <AnimatePresence>
          {taskBoardVisible && <TaskBoard />}
        </AnimatePresence>
        <AnimatePresence>
          {liveViewVisible && <LiveViewPanel />}
        </AnimatePresence>
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
    </>
  );
}
