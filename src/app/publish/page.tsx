"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Rocket, Loader2, Folder, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/agents/types";

export default function PublishLandingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getClient();
    supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setProjects((data ?? []) as Project[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-boss-bg">
      <nav className="sticky top-0 z-40 border-b border-boss-border bg-boss-surface/95 glass-strong">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-primary">
            <Crown className="w-4 h-4 text-gold" />
            <span className="font-bold text-sm">Grand Studio</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
              Dashboard
            </Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Rocket className="w-8 h-8 text-gold" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Publish to Steam</h1>
            <p className="text-text-muted text-sm mt-0.5">
              Prepare store assets, build config, and Steam checklist. Then complete publishing in Steamworks.
            </p>
          </div>
        </div>

        <p className="text-text-secondary text-sm mb-4">
          Select a project to open the Steam Publishing Wizard (game info, store assets, build command, checklist).
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-boss-border bg-boss-card p-8 text-center">
            <Folder className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-muted mb-4">No projects yet. Create a project first, then return here to publish.</p>
            <Link href="/">
              <Button className="bg-gold hover:bg-gold/90 text-boss-bg gap-2">
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {projects.map((proj) => (
              <li key={proj.id}>
                <Link
                  href={`/project/${proj.id}/publish`}
                  className="flex items-center justify-between rounded-xl border border-boss-border bg-boss-card px-4 py-3 hover:border-gold/40 hover:bg-boss-card/80 transition-colors"
                >
                  <span className="font-medium text-text-primary truncate">{proj.name}</span>
                  <ArrowRight className="w-4 h-4 text-text-muted shrink-0 ml-2" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
