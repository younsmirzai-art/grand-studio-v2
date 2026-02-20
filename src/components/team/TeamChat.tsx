"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { useProjectStore } from "@/lib/stores/projectStore";
import { Skeleton } from "@/components/ui/skeleton";

interface TeamChatProps {
  loading?: boolean;
  onExecuteCode?: (code: string) => void;
}

export function TeamChat({ loading, onExecuteCode }: TeamChatProps) {
  const chatTurns = useProjectStore((s) => s.chatTurns);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log("[TeamChat] rendering", chatTurns.length, "chat turns");
    if (chatTurns.length > 0) {
      console.log("[TeamChat] last turn:", chatTurns[chatTurns.length - 1].agent_name, "-", chatTurns[chatTurns.length - 1].content?.slice(0, 80));
    }
  }, [chatTurns]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatTurns.length]);

  if (loading) {
    return (
      <div className="flex-1 p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-8 h-8 rounded-lg bg-boss-elevated shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32 bg-boss-elevated" />
              <Skeleton className="h-16 w-full bg-boss-elevated rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (chatTurns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <MessageSquare className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary">No messages yet</p>
          <p className="text-text-muted text-sm">
            Send a command to start the conversation
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
      <AnimatePresence initial={false}>
        {chatTurns.map((turn) => (
          <ChatMessage
            key={turn.id}
            turn={turn}
            onExecuteCode={onExecuteCode}
          />
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
