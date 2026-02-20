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

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const project = useProjectStore((s) => s.project);
  const { taskBoardVisible } = useUIStore();
  const { setAutonomousRunning, isAutonomousRunning } = useProjectStore();
  const [isRunningTurn, setIsRunningTurn] = useState(false);
  const autonomousRef = useRef(false);

  const sendBossCommand = useCallback(
    async (message: string) => {
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
      }
    },
    [projectId]
  );

  const runOneTurn = useCallback(async () => {
    setIsRunningTurn(true);
    try {
      const res = await fetch("/api/agents/route-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        toast.error("Failed to run turn");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setIsRunningTurn(false);
    }
  }, [projectId]);

  const startAutonomous = useCallback(() => {
    autonomousRef.current = true;
    setAutonomousRunning(true);
    toast.success("Autonomous mode started");

    const run = async () => {
      while (autonomousRef.current) {
        try {
          const res = await fetch("/api/agents/autonomous", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId }),
          });
          if (!res.ok) break;

          const data = await res.json();
          if (data.done) {
            toast.info("All tasks completed");
            break;
          }
        } catch {
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      autonomousRef.current = false;
      setAutonomousRunning(false);
    };

    run();
  }, [projectId, setAutonomousRunning]);

  const stopAutonomous = useCallback(() => {
    autonomousRef.current = false;
    setAutonomousRunning(false);
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
        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          {/* Controls */}
          <div className="px-4 py-2 border-b border-boss-border flex items-center justify-between">
            <ControlPanel
              onRunOneTurn={runOneTurn}
              onStartAutonomous={startAutonomous}
              onStopAutonomous={stopAutonomous}
              isRunningTurn={isRunningTurn}
            />
          </div>

          {/* Chat */}
          <TeamChat onExecuteCode={handleExecuteCode} />

          {/* God-Eye */}
          <GodEyePanel />

          {/* Boss input */}
          <div className="p-4 border-t border-boss-border bg-boss-surface/50">
            <CommandInput
              onSend={sendBossCommand}
              disabled={isAutonomousRunning}
            />
          </div>
        </div>

        {/* Task board panel */}
        <AnimatePresence>
          {taskBoardVisible && <TaskBoard />}
        </AnimatePresence>
      </div>
    </>
  );
}
