"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { useUIStore } from "@/lib/stores/uiStore";
import { useProjectStore } from "@/lib/stores/projectStore";
import { getClient } from "@/lib/supabase/client";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";
import { useRealtimeGodEye } from "@/hooks/useRealtimeGodEye";
import { useRealtimeTasks } from "@/hooks/useRealtimeTasks";
import { useUE5Status } from "@/hooks/useUE5Status";
import type { Project } from "@/lib/agents/types";
import { Skeleton } from "@/components/ui/skeleton";
import { SketchfabSearchModal } from "@/components/tools/SketchfabSearch";
import { VoiceGeneratorModal } from "@/components/tools/VoiceGenerator";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const projectId = params.id as string;
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const { project, setProject, isRelayConnected } = useProjectStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getClient();
    supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single()
      .then(({ data }) => {
        if (data) setProject(data as Project);
        setLoading(false);
      });

    return () => {
      setProject(null);
    };
  }, [projectId, setProject]);

  useRealtimeChat(projectId);
  useRealtimeGodEye(projectId);
  useRealtimeTasks(projectId);
  useUE5Status(projectId);

  if (loading) {
    return (
      <div className="flex h-screen bg-boss-bg">
        <div className="w-64 bg-boss-surface border-r border-boss-border p-4 space-y-4">
          <Skeleton className="h-8 w-32 bg-boss-elevated" />
          <Skeleton className="h-4 w-full bg-boss-elevated" />
          <Skeleton className="h-4 w-3/4 bg-boss-elevated" />
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-8 w-64 bg-boss-elevated mb-4" />
          <Skeleton className="h-[400px] w-full bg-boss-elevated rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-boss-bg overflow-hidden">
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 overflow-hidden"
          >
            <Sidebar
              projectName={project?.name}
              projectStatus={project?.status}
              ue5Connected={isRelayConnected}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
      <SketchfabSearchModal projectId={projectId} />
      <VoiceGeneratorModal projectId={projectId} />
    </div>
  );
}
