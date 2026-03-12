"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Folder, Clock, Crown, Sparkles, Loader2, Check,
  Cpu, Package, Eye, MessageSquare, Cog, Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";
import { ProjectStarter } from "@/components/boss/ProjectStarter";
import { toast } from "sonner";

const FEATURES = [
  {
    icon: Cpu,
    title: "AI Co-Pilot",
    desc: "Describe your scene in natural language. AI generates production-ready UE5 Python code and executes it automatically.",
    color: "#d4a017",
  },
  {
    icon: Package,
    title: "Asset Library",
    desc: "40+ Starter Content assets organized by category. Materials, meshes, architecture — all integrated into AI responses.",
    color: "#22c55e",
  },
  {
    icon: Eye,
    title: "Visual Preview",
    desc: "See screenshots of your scene after every build. AI evaluates quality and auto-fixes issues.",
    color: "#a78bfa",
  },
];

const STEPS = [
  {
    icon: MessageSquare,
    title: "Describe",
    desc: "Tell the AI what you want to build. \"Build a medieval castle with towers and a moat.\"",
    color: "#d4a017",
  },
  {
    icon: Cog,
    title: "Generate",
    desc: "AI writes 100+ lines of UE5 Python code using real Starter Content assets and materials.",
    color: "#a78bfa",
  },
  {
    icon: Rocket,
    title: "Execute",
    desc: "Code auto-executes in UE5 via the relay. Watch your scene come to life in real-time.",
    color: "#22c55e",
  },
];

const EXAMPLE_PROMPTS = [
  "Medieval castle with towers and a moat",
  "Sci-fi space station interior",
  "Tropical island with palm trees",
  "Modern city block with skyscrapers",
  "Horror mansion at night",
];

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [quickPrompt, setQuickPrompt] = useState("");
  const [quickBuilding, setQuickBuilding] = useState(false);
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

  const handleBuildMyScene = useCallback(async () => {
    const prompt = quickPrompt.trim();
    if (!prompt || quickBuilding) return;
    setQuickBuilding(true);
    try {
      const supabase = getClient();
      const name = prompt.length > 50 ? prompt.slice(0, 47) + "…" : prompt;
      const { data, error } = await supabase
        .from("projects")
        .insert({
          name,
          initial_prompt: prompt,
          status: "active",
        })
        .select()
        .single();
      if (error) {
        toast.error("Failed to create project");
        return;
      }
      const project = data as Project;
      router.push(`/project/${project.id}?build=1`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setQuickBuilding(false);
    }
  }, [quickPrompt, quickBuilding, router]);

  return (
    <div className="min-h-screen bg-boss-bg overflow-x-hidden">
      {/* ────────── NAV ────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-boss-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center gold-glow">
              <Crown className="w-4 h-4 text-gold" />
            </div>
            <span className="text-lg font-bold text-text-primary tracking-tight">
              Grand <span className="text-gradient-gold">Studio</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-text-muted">
            <a href="#features" className="hover:text-text-primary transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-text-primary transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-text-primary transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              Login
            </Link>
            <Link href="/auth/signup">
              <Button className="bg-gold hover:bg-gold/90 text-boss-bg font-semibold text-sm">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ────────── HERO ────────── */}
      <section className="relative min-h-[85vh] flex items-center justify-center pt-20 pb-16 px-4">
        <div className="absolute inset-0 hero-grid" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-gold/5 animate-glow-pulse" />

        <div className="relative z-10 w-full max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-text-primary mb-3">
              Grand Studio — UE5 AI Co-Pilot
            </h1>
            <p className="text-text-muted text-sm md:text-base max-w-lg mx-auto">
              Build UE5 scenes 10x faster with AI. Describe what you want, AI writes the code, Unreal Engine builds it live.
            </p>
          </div>

          <div className="relative">
            <textarea
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleBuildMyScene()}
              placeholder="e.g. Build me a medieval castle with towers and a moat"
              rows={4}
              className="w-full px-5 py-4 rounded-2xl bg-boss-card border-2 border-boss-border text-text-primary placeholder:text-text-muted resize-none text-base focus:outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/20 transition-all shadow-lg"
              disabled={quickBuilding}
            />
            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-[calc(100%+8px)] h-1 rounded-full bg-gradient-to-r from-transparent via-gold/40 to-transparent blur-sm pointer-events-none" />
          </div>

          <div className="mt-6 flex flex-col items-center gap-4">
            <Button
              onClick={handleBuildMyScene}
              disabled={!quickPrompt.trim() || quickBuilding}
              size="lg"
              className="w-full max-w-sm bg-agent-green hover:bg-agent-green/90 text-white font-bold text-lg py-6 rounded-xl shadow-lg shadow-agent-green/25 gap-2 transition-all disabled:opacity-50"
            >
              {quickBuilding ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Rocket className="w-5 h-5" />
              )}
              Build My Scene
            </Button>

            <p className="text-text-muted text-xs">Try an example:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setQuickPrompt(example)}
                  className="px-4 py-2 rounded-full border border-boss-border bg-boss-elevated/80 text-text-secondary text-sm hover:border-gold/40 hover:text-text-primary transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-text-muted text-xs mt-6">
            Or{" "}
            <button
              type="button"
              onClick={() => setShowNewProject(true)}
              className="text-gold hover:underline"
            >
              create a project with name + prompt
            </button>{" "}
            for more control.
          </p>

          {!loading && projects.length > 0 && (
            <div className="mt-10 w-full max-w-xl mx-auto">
              <p className="text-xs text-text-muted mb-3 text-center">Recent projects</p>
              <div className="flex flex-wrap justify-center gap-2">
                {projects.slice(0, 5).map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => router.push(`/project/${proj.id}`)}
                    className="px-4 py-2 rounded-xl border border-boss-border bg-boss-card/60 text-text-secondary text-sm hover:border-gold/40 hover:text-text-primary transition-colors text-left max-w-[200px] truncate"
                  >
                    {proj.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ────────── FEATURES ────────── */}
      <section id="features" className="py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-boss-surface/50 to-transparent" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.25em] text-agent-green mb-3">Features</p>
            <h2 className="text-4xl md:text-5xl font-black text-text-primary tracking-tight">
              Everything You Need
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="agent-card-glow group relative rounded-2xl border bg-boss-card/80 p-8 overflow-hidden"
                style={{ borderColor: f.color + "30" }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `radial-gradient(circle at center, ${f.color}08 0%, transparent 70%)` }}
                />
                <div className="relative z-10">
                  <div
                    className="w-14 h-14 rounded-2xl border-2 flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110"
                    style={{
                      borderColor: f.color + "50",
                      backgroundColor: f.color + "10",
                    }}
                  >
                    <f.icon className="w-7 h-7" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary mb-2">{f.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────── HOW IT WORKS ────────── */}
      <section id="how-it-works" className="py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-boss-surface/50 to-transparent" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.25em] text-agent-amber mb-3">How It Works</p>
            <h2 className="text-4xl md:text-5xl font-black text-text-primary tracking-tight">
              Three Steps to Your Scene
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.title} className="text-center group">
                <div className="relative mb-6">
                  <div
                    className="w-20 h-20 rounded-2xl border-2 flex items-center justify-center mx-auto transition-all duration-300 group-hover:scale-110"
                    style={{
                      borderColor: step.color + "40",
                      backgroundColor: step.color + "10",
                    }}
                  >
                    <step.icon className="w-8 h-8" style={{ color: step.color }} />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-boss-elevated border border-boss-border flex items-center justify-center text-xs font-bold text-gold">
                    {i + 1}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-text-primary mb-2">{step.title}</h3>
                <p className="text-text-muted text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────── POWERED BY ────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm uppercase tracking-[0.25em] text-text-muted mb-3">Powered By</p>
          <h2 className="text-3xl md:text-4xl font-black text-text-primary tracking-tight mb-4">
            The Most Powerful Stack
          </h2>
          <p className="text-text-secondary mb-12 max-w-2xl mx-auto">
            Built on the most powerful game engine, powered by frontier AI models.
          </p>

          <div className="flex flex-wrap justify-center gap-6 mb-12">
            {[
              { label: "Unreal Engine 5", sub: "Game Engine" },
              { label: "OpenRouter", sub: "AI Gateway" },
              { label: "Supabase", sub: "Database & Realtime" },
            ].map((tech) => (
              <div
                key={tech.label}
                className="px-8 py-5 rounded-xl border border-boss-border bg-boss-card/50 hover:border-gold/30 transition-all duration-300"
              >
                <p className="font-bold text-text-primary text-sm">{tech.label}</p>
                <p className="text-text-muted text-xs">{tech.sub}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {["Gemini 2.0", "Claude Sonnet", "GPT-4o", "DeepSeek v3.1"].map((model) => (
              <span
                key={model}
                className="px-4 py-2 rounded-full border border-boss-border bg-boss-elevated/50 text-xs text-text-secondary font-medium"
              >
                {model}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ────────── PRICING ────────── */}
      <section id="pricing" className="py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.25em] text-agent-violet mb-3">Pricing</p>
            <h2 className="text-4xl md:text-5xl font-black text-text-primary tracking-tight mb-4">
              Simple Pricing
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free tier */}
            <div className="rounded-2xl border border-boss-border bg-boss-card/60 p-8">
              <h3 className="text-xl font-bold text-text-primary mb-2">Free</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-black text-text-primary">$0</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Unlimited projects",
                  "AI code generation",
                  "UE5 execution",
                  "Asset library",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-text-secondary">
                    <Check className="w-4 h-4 text-agent-green shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="w-full border-boss-border text-text-muted cursor-default"
                disabled
              >
                Current Plan
              </Button>
            </div>

            {/* Pro tier */}
            <div className="relative rounded-2xl border border-gold/40 bg-boss-card pricing-popular p-8">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gold text-boss-bg text-xs font-bold">
                Coming Soon
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">Pro</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-black text-text-primary">$29</span>
                <span className="text-text-muted text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Priority AI models",
                  "Cloud UE5 rendering",
                  "Advanced vision loop",
                  "Priority support",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-text-secondary">
                    <Check className="w-4 h-4 text-agent-green shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full bg-gold/20 text-gold font-semibold cursor-default"
                disabled
              >
                Coming Soon
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ────────── YOUR PROJECTS ────────── */}
      {!loading && projects.length > 0 && (
        <section className="py-24 px-6 border-t border-boss-border">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-text-primary flex items-center gap-3">
                <Folder className="w-6 h-6 text-gold" />
                Your Projects
              </h3>
              <Button
                onClick={() => setShowNewProject(true)}
                className="bg-gold hover:bg-gold/90 text-boss-bg font-semibold gap-2"
              >
                <Plus className="w-4 h-4" />
                New Project
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => router.push(`/project/${project.id}`)}
                  className="rounded-2xl border border-boss-border bg-boss-card/60 p-6 cursor-pointer hover:border-gold/30 hover:bg-boss-elevated/50 transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-bold text-text-primary group-hover:text-gold transition-colors">
                      {project.name}
                    </h4>
                    <StatusBadge status={project.status} />
                  </div>
                  <p className="text-text-muted text-sm line-clamp-2 mb-4">
                    {project.initial_prompt}
                  </p>
                  <div className="flex items-center gap-2 text-text-muted text-xs">
                    <Clock className="w-3 h-3" />
                    {new Date(project.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <section className="py-24 px-6 border-t border-boss-border">
          <div className="max-w-7xl mx-auto text-center">
            <Sparkles className="w-12 h-12 text-gold/40 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-text-primary mb-2">Ready to build?</h3>
            <p className="text-text-muted mb-6">
              Create your first project and start building UE5 scenes with AI.
            </p>
            <Button
              onClick={() => setShowNewProject(true)}
              className="bg-gold hover:bg-gold/90 text-boss-bg font-semibold gap-2 cta-glow"
            >
              <Plus className="w-4 h-4" />
              Create Your First Project
            </Button>
          </div>
        </section>
      )}

      {loading && (
        <section className="py-24 px-6 border-t border-boss-border">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-boss-card border border-boss-border rounded-2xl p-6">
                  <Skeleton className="h-5 w-3/4 mb-3 bg-boss-elevated" />
                  <Skeleton className="h-4 w-full mb-2 bg-boss-elevated" />
                  <Skeleton className="h-4 w-2/3 bg-boss-elevated" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ────────── FOOTER ────────── */}
      <footer className="border-t border-boss-border py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                <Crown className="w-4 h-4 text-gold" />
              </div>
              <span className="font-bold text-text-primary">Grand Studio</span>
            </div>

            <div className="flex items-center gap-8 text-sm text-text-muted">
              <a href="#" className="hover:text-text-primary transition-colors">About</a>
              <a href="#" className="hover:text-text-primary transition-colors">Docs</a>
              <a href="#" className="hover:text-text-primary transition-colors">Discord</a>
              <a href="#" className="hover:text-text-primary transition-colors">Twitter</a>
            </div>

            <div className="text-sm text-text-muted">
              &copy; {new Date().getFullYear()} Grand Studio
            </div>
          </div>
        </div>
      </footer>

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
