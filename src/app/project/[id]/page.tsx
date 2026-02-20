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
import { useProjectStore } from "@/lib/stores/projectStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { getClient } from "@/lib/supabase/client";
import { TEAM } from "@/lib/agents/identity";
import type { ChatTurn } from "@/lib/agents/types";

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
  const { setAutonomousRunning, isAutonomousRunning, setChatTurns } = useProjectStore();
  const [isRunningTurn, setIsRunningTurn] = useState(false);
  const [typingAgents, setTypingAgents] = useState<string[]>([]);
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
      const supabase = getClient();

      await supabase.from("chat_turns").insert({
        project_id: projectId,
        agent_name: "Boss",
        agent_title: "ریس",
        content: `@${agentName} ${message}`,
        turn_type: "direct_command",
      });

      setTypingAgents([agentName]);

      try {
        const res = await fetch("/api/agents/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, agentName, message }),
        });

        if (!res.ok) {
          const err = await res.text();
          toast.error(`${agentName} error: ${err}`);
        }
      } catch (err) {
        toast.error(`Network error reaching ${agentName}`);
        console.error(err);
      } finally {
        setTypingAgents([]);
        await refetchChat();
      }
    },
    [projectId, refetchChat]
  );

  const sendBossCommand = useCallback(
    async (message: string) => {
      const direct = parseDirectMention(message);
      if (direct) {
        return sendDirectMessage(direct.agentName, direct.cleanMessage);
      }

      const supabase = getClient();

      await supabase.from("chat_turns").insert({
        project_id: projectId,
        agent_name: "Boss",
        agent_title: "ریس",
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
    async (code: string) => {
      const supabase = getClient();
      await supabase.from("ue5_commands").insert({
        project_id: projectId,
        code,
        status: "pending",
      });
      toast.success("Code queued for UE5 execution");
    },
    [projectId]
  );

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
              disabled={isAutonomousRunning}
              agentNames={AGENT_NAMES}
            />
          </div>
        </div>

        <AnimatePresence>
          {taskBoardVisible && <TaskBoard />}
        </AnimatePresence>
      </div>
    </>
  );
}
