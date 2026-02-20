"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Folder, Clock, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/agents/types";
import { ProjectStarter } from "@/components/boss/ProjectStarter";

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = getClient();
    supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (data) setProjects(data as Project[]);
        setLoading(false);
      });
  }, []);

  const handleProjectCreated = (project: Project) => {
    setShowNewProject(false);
    router.push(`/project/${project.id}`);
  };

  return (
    <div className="min-h-screen bg-boss-bg">
      {/* Header */}
      <header className="border-b border-boss-border bg-boss-surface/50 glass-strong sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center gold-glow">
              <Crown className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary tracking-tight">
                Grand Studio
              </h1>
              <p className="text-xs text-text-muted">
                v2 — AI Game Development Command Center
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowNewProject(true)}
            className="bg-gold hover:bg-gold/90 text-boss-bg font-semibold gap-2"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Hero section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h2 className="text-4xl font-bold text-text-primary mb-3 tracking-tight">
            Command Your{" "}
            <span className="text-gold">AI Development Team</span>
          </h2>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            Five AI agents collaborate on your Unreal Engine 5 projects.
            You give orders — they build worlds.
          </p>
        </motion.div>

        {/* Agent team preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-5 gap-3 mb-12"
        >
          {[
            { name: "Nima", title: "Project Manager", icon: "📋", color: "border-gold/30 bg-gold/5" },
            { name: "Alex", title: "Lead Architect", icon: "🏗️", color: "border-agent-violet/30 bg-agent-violet/5" },
            { name: "Thomas", title: "Lead Programmer", icon: "💻", color: "border-agent-green/30 bg-agent-green/5" },
            { name: "Elena", title: "Narrative Designer", icon: "📖", color: "border-agent-amber/30 bg-agent-amber/5" },
            { name: "Morgan", title: "Technical Reviewer", icon: "🔍", color: "border-agent-rose/30 bg-agent-rose/5" },
          ].map((agent) => (
            <div
              key={agent.name}
              className={`rounded-xl border ${agent.color} p-4 text-center`}
            >
              <div className="text-2xl mb-2">{agent.icon}</div>
              <div className="font-semibold text-text-primary text-sm">
                {agent.name}
              </div>
              <div className="text-text-muted text-xs">{agent.title}</div>
            </div>
          ))}
        </motion.div>

        {/* Projects grid */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Folder className="w-5 h-5 text-text-secondary" />
            Your Projects
          </h3>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-boss-card border border-boss-border rounded-xl p-6"
              >
                <Skeleton className="h-5 w-3/4 mb-3 bg-boss-elevated" />
                <Skeleton className="h-4 w-full mb-2 bg-boss-elevated" />
                <Skeleton className="h-4 w-2/3 bg-boss-elevated" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Sparkles className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary text-lg mb-2">
              No projects yet
            </p>
            <p className="text-text-muted mb-6">
              Create your first project and start commanding your AI team.
            </p>
            <Button
              onClick={() => setShowNewProject(true)}
              className="bg-gold hover:bg-gold/90 text-boss-bg font-semibold gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          </motion.div>
        ) : (
          <AnimatePresence>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project, i) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  onClick={() => router.push(`/project/${project.id}`)}
                  className="bg-boss-card border border-boss-border rounded-xl p-6 cursor-pointer hover:border-boss-border-focus hover:bg-boss-elevated/50 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-semibold text-text-primary group-hover:text-gold transition-colors">
                      {project.name}
                    </h4>
                    <StatusBadge status={project.status} />
                  </div>
                  <p className="text-text-secondary text-sm line-clamp-2 mb-4">
                    {project.initial_prompt}
                  </p>
                  <div className="flex items-center gap-2 text-text-muted text-xs">
                    <Clock className="w-3 h-3" />
                    {new Date(project.updated_at).toLocaleDateString()}
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </main>

      {/* New project dialog */}
      <ProjectStarter
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        onCreated={handleProjectCreated}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "bg-agent-green/10", text: "text-agent-green", label: "Active" },
    paused: { bg: "bg-agent-amber/10", text: "text-agent-amber", label: "Paused" },
    completed: { bg: "bg-agent-violet/10", text: "text-agent-violet", label: "Done" },
  };
  const c = config[status] ?? config.active;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
