"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "@/lib/stores/projectStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { LogEntry } from "./LogEntry";

export function GodEyePanel() {
  const godEyeLog = useProjectStore((s) => s.godEyeLog);
  const { godEyeExpanded, toggleGodEye, godEyeFilter, setGodEyeFilter } = useUIStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLog = godEyeFilter
    ? godEyeLog.filter((e) => e.event_type === godEyeFilter)
    : godEyeLog;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLog.length]);

  const eventTypes = ["thinking", "api_call", "api_ok", "fallback", "turn", "boss", "execution", "screenshot", "error", "routing", "debug", "debug_success"];

  return (
    <motion.div
      layout
      className="border-t border-boss-border bg-boss-surface"
    >
      {/* Header */}
      <button
        onClick={toggleGodEye}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-boss-elevated/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-agent-teal" />
          <span className="text-sm font-medium text-text-primary">God-Eye Log</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-boss-border text-text-muted">
            {godEyeLog.length}
          </Badge>
        </div>
        {godEyeExpanded ? (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronUp className="w-4 h-4 text-text-muted" />
        )}
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {godEyeExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 300, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Filters */}
            <div className="flex items-center gap-1 px-4 py-1.5 border-t border-boss-border overflow-x-auto scrollbar-thin">
              <Filter className="w-3 h-3 text-text-muted shrink-0" />
              <Button
                size="sm"
                variant={godEyeFilter === null ? "secondary" : "ghost"}
                onClick={() => setGodEyeFilter(null)}
                className="h-5 px-2 text-[10px]"
              >
                All
              </Button>
              {eventTypes.map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant={godEyeFilter === type ? "secondary" : "ghost"}
                  onClick={() => setGodEyeFilter(type)}
                  className="h-5 px-2 text-[10px]"
                >
                  {type}
                </Button>
              ))}
            </div>

            {/* Log entries */}
            <div
              ref={scrollRef}
              className="h-[calc(300px-68px)] overflow-y-auto scrollbar-thin font-mono text-xs p-2"
            >
              {filteredLog.length === 0 ? (
                <div className="flex items-center justify-center h-full text-text-muted">
                  No log entries
                </div>
              ) : (
                filteredLog.map((entry) => (
                  <LogEntry key={entry.id} entry={entry} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
