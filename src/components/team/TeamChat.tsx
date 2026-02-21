"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { useProjectStore } from "@/lib/stores/projectStore";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentAvatar } from "./AgentAvatar";

interface TeamChatProps {
  loading?: boolean;
  onExecuteCode?: (code: string) => void;
  onRecreateImage?: (imageUrl: string) => void | Promise<void>;
  typingAgents?: string[];
}

export function TeamChat({ loading, onExecuteCode, onRecreateImage, typingAgents = [] }: TeamChatProps) {
  const chatTurns = useProjectStore((s) => s.chatTurns);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatTurns.length, typingAgents.length]);

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

  if (chatTurns.length === 0 && typingAgents.length === 0) {
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
          <p className="text-text-muted text-xs mt-2">
            Use <span className="text-gold font-mono">@name</span> to chat with a specific agent
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
            onRecreateImage={onRecreateImage}
          />
        ))}
      </AnimatePresence>

      {typingAgents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-3 flex items-center gap-3"
        >
          <div className="flex -space-x-2">
            {typingAgents.slice(0, 5).map((name) => (
              <div key={name} className="relative">
                <AgentAvatar name={name} size="sm" showStatus status="thinking" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted text-xs">
              {typingAgents.length === 1
                ? `${typingAgents[0]} is thinking`
                : `${typingAgents.length} agents are thinking`}
            </span>
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
        </motion.div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
