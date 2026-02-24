"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

type Phase = "writing" | "executing" | "done" | "error";

interface SmartBuildViewProps {
  projectId: string;
  prompt: string;
  projectContext?: string;
  onDone?: (success: boolean) => void;
  onStop?: () => void;
}

export default function SmartBuildView({
  projectId,
  prompt,
  projectContext,
  onDone,
  onStop,
}: SmartBuildViewProps) {
  const [phase, setPhase] = useState<Phase>("writing");
  const [streamingContent, setStreamingContent] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (phase === "done" || phase === "error") return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  const runStream = useCallback(async () => {
    setPhase("writing");
    setStreamingContent("");
    setErrorMessage(null);
    startTimeRef.current = Date.now();
    stoppedRef.current = false;

    try {
      const res = await fetch("/api/build/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), projectContext }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error ?? `Request failed: ${res.status}`);
        setPhase("error");
        onDone?.(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        setPhase("error");
        setErrorMessage("No response body");
        onDone?.(false);
        return;
      }

      let content = "";
      while (true) {
        if (stoppedRef.current) {
          setPhase("error");
          setErrorMessage("Stopped by user");
          onDone?.(false);
          return;
        }
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

      if (stoppedRef.current) {
        setPhase("error");
        onDone?.(false);
        return;
      }

      setPhase("executing");

      const execRes = await fetch("/api/build/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, rawResponse: content }),
      });

      const execData = await execRes.json();

      if (!execRes.ok || !execData.commandId) {
        setErrorMessage(execData.error ?? "Failed to execute code");
        setPhase("error");
        onDone?.(false);
        return;
      }

      const commandId = execData.commandId as string;

      for (let i = 0; i < 30; i++) {
        if (stoppedRef.current) {
          setPhase("error");
          onDone?.(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(
          `/api/build/status?commandId=${encodeURIComponent(commandId)}`
        );
        const cmd = statusRes.ok ? await statusRes.json() : null;

        if (cmd?.status === "success") {
          setPhase("done");
          onDone?.(true);
          return;
        }
        if (cmd?.status === "error") {
          setErrorMessage(cmd.error_log ?? "Execution failed");
          setPhase("error");
          onDone?.(false);
          return;
        }
      }

      setErrorMessage("Execution timeout");
      setPhase("error");
      onDone?.(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setPhase("error");
      onDone?.(false);
    }
  }, [projectId, prompt, projectContext, onDone]);

  useEffect(() => {
    runStream();
  }, []);

  const handleStop = () => {
    stoppedRef.current = true;
    onStop?.();
  };

  return (
    <div className="flex flex-col h-full bg-boss-surface border-b border-boss-border">
      <div className="shrink-0 px-4 py-3 border-b border-boss-border">
        <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
          🏗️ Building: {prompt.slice(0, 50)}{prompt.length > 50 ? "…" : ""}
        </h2>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-boss-elevated overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gold"
              initial={{ width: "0%" }}
              animate={{
                width:
                  phase === "writing"
                    ? "33%"
                    : phase === "executing"
                      ? "66%"
                      : phase === "done" || phase === "error"
                        ? "100%"
                        : "33%",
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-xs font-medium text-text-muted shrink-0">
            {phase === "writing" && "✍️ Writing code"}
            {phase === "executing" && "🚀 Executing in UE5"}
            {phase === "done" && "✅ Done"}
            {phase === "error" && "❌ Error"}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-text-muted">
          <span>⏱️ {elapsed}s</span>
          {phase !== "done" && phase !== "error" && (
            <Button
              size="sm"
              variant="outline"
              className="border-agent-rose/30 text-agent-rose hover:bg-agent-rose/10 h-7"
              onClick={handleStop}
            >
              ⏹️ Stop
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-4 py-2 border-b border-boss-border text-xs font-medium text-text-muted">
          💻 Grand Studio
        </div>
        <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-text-secondary whitespace-pre-wrap break-words bg-boss-elevated/30">
          <code>{streamingContent || "…"}</code>
          {(phase === "writing" || phase === "executing") && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-gold animate-pulse align-middle" />
          )}
        </pre>
      </div>

      {phase === "error" && errorMessage && (
        <div className="shrink-0 px-4 py-2 border-t border-agent-rose/30 bg-agent-rose/5 text-sm text-agent-rose">
          {errorMessage}
        </div>
      )}

      {phase === "done" && (
        <div className="shrink-0 px-4 py-2 border-t border-agent-green/30 bg-agent-green/5 text-sm text-agent-green">
          ✅ Built successfully! Check the viewport.
        </div>
      )}
    </div>
  );
}
