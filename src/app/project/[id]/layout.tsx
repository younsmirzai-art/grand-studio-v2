"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/lib/stores/projectStore";
import { getClient } from "@/lib/supabase/client";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";
import { useRealtimeGodEye } from "@/hooks/useRealtimeGodEye";
import { useRealtimeTasks } from "@/hooks/useRealtimeTasks";
import { useUE5Status } from "@/hooks/useUE5Status";
import type { Project } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { SketchfabSearchModal } from "@/components/tools/SketchfabSearch";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const projectId = params.id as string;
  const { setProject } = useProjectStore();
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
      <div className="flex h-screen bg-[#0A0A0B]">
        <div className="flex-1 p-8">
          <Skeleton className="h-8 w-64 bg-[#111114] mb-4" />
          <Skeleton className="h-[400px] w-full bg-[#111114] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0A0A0B] overflow-hidden">
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
      <SketchfabSearchModal projectId={projectId} />
    </div>
  );
}
