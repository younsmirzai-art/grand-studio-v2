"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Folder, Clock, Crown, Sparkles, ChevronRight, Users, Monitor, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/agents/types";
import { ProjectStarter } from "@/components/boss/ProjectStarter";
import { toast } from "sonner";

const AGENTS = [
  { name: "Nima", role: "Strategist", icon: "📋", color: "#d4a017", line: "Plans your game's roadmap", glow: "rgba(212,160,23,0.3)" },
  { name: "Alex", role: "Architect", icon: "🏗️", color: "#ef4444", line: "Designs systems & blueprints", glow: "rgba(239,68,68,0.3)" },
  { name: "Thomas", role: "Programmer", icon: "💻", color: "#22c55e", line: "Writes & executes UE5 code", glow: "rgba(34,197,94,0.3)" },
  { name: "Elena", role: "Narrative Designer", icon: "📖", color: "#a78bfa", line: "Crafts worlds & stories", glow: "rgba(167,139,250,0.3)" },
  { name: "Morgan", role: "Reviewer", icon: "🔍", color: "#0ea5e9", line: "Reviews & optimizes everything", glow: "rgba(14,165,233,0.3)" },
];

const STEPS = [
  { icon: Crown, title: "Give Orders", desc: "You type commands as the Boss. Direct your team with natural language.", color: "#d4a017" },
  { icon: Users, title: "AI Collaborates", desc: "Agents discuss, plan, consult each other, and build consensus.", color: "#a78bfa" },
  { icon: Monitor, title: "Game Gets Built", desc: "Code executes directly in Unreal Engine 5. Your world comes alive.", color: "#22c55e" },
];

const FEATURES = [
  { icon: "🎯", title: "Direct Commands", desc: "Talk to specific agents with @mentions" },
  { icon: "🧠", title: "Agent Memory", desc: "Your team remembers every decision" },
  { icon: "🤝", title: "Auto-Consultation", desc: "Agents collaborate before acting" },
  { icon: "⚡", title: "Live UE5 Execution", desc: "Code runs directly in Unreal Engine" },
  { icon: "👁️", title: "God-Eye View", desc: "See everything happening in real-time" },
  { icon: "🌍", title: "World Building", desc: "PCG, Landmass, Megascans integration" },
];

const TIERS = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    features: ["1 project", "50 messages/day", "Basic agents", "Community support"],
    highlighted: false,
    tierId: null as string | null,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    features: ["Unlimited projects", "Unlimited messages", "All 5 agents", "UE5 code execution", "Pixel Streaming", "Email support"],
    highlighted: true,
    tierId: "pro",
  },
  {
    name: "Studio",
    price: "$99",
    period: "/month",
    features: ["Everything in Pro", "Custom agents", "Team collaboration", "Priority AI models", "API access", "Advanced analytics"],
    highlighted: false,
    tierId: "studio",
  },
  {
    name: "Enterprise",
    price: "$299",
    period: "/month",
    features: ["Dedicated cloud UE5", "SLA", "Custom integrations", "Priority support", "Dedicated success manager"],
    highlighted: false,
    tierId: "enterprise",
  },
];

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState<string | null>(null);
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

  const joinWaitlist = useCallback(async () => {
    if (!waitlistEmail || waitlistLoading) return;
    setWaitlistLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail, plan: "pro" }),
      });
      if (res.ok) {
        toast.success("You're on the waitlist!");
        setWaitlistEmail("");
      } else {
        toast.error("Failed to join waitlist");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setWaitlistLoading(false);
    }
  }, [waitlistEmail, waitlistLoading]);

  const handleCheckout = useCallback(
    async (tierId: string) => {
      if (checkoutTier) return;
      setCheckoutTier(tierId);
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: tierId }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        toast.error(data.error ?? "Checkout failed");
      } catch {
        toast.error("Network error");
      } finally {
        setCheckoutTier(null);
      }
    },
    [checkoutTier]
  );

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
            <a href="#team" className="hover:text-text-primary transition-colors">Team</a>
            <a href="#features" className="hover:text-text-primary transition-colors">Features</a>
            <a href="#pricing" className="hover:text-text-primary transition-colors">Pricing</a>
          </div>
          <Button
            onClick={() => setShowNewProject(true)}
            className="bg-gold hover:bg-gold/90 text-boss-bg font-semibold gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>
      </nav>

      {/* ────────── HERO ────────── */}
      <section className="relative min-h-screen flex items-center justify-center pt-16">
        <div className="absolute inset-0 hero-grid" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gold/5 animate-glow-pulse" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-agent-violet/5 animate-glow-pulse" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-agent-teal/5 animate-glow-pulse" style={{ animationDelay: "4s" }} />

        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
          <div className="animate-fade-in-up">
            <p className="text-sm uppercase tracking-[0.3em] text-gold/80 mb-6 font-medium">
              AI-Powered Game Development
            </p>
            <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-[0.9] mb-6">
              <span className="text-gradient-hero">Grand</span>
              <br />
              <span className="text-text-primary">Studio</span>
            </h1>
            <p className="text-xl md:text-2xl text-text-secondary font-medium mb-2">
              Command Your AI Army. Build AAA Games.
            </p>
            <p className="text-text-muted max-w-xl mx-auto mb-10">
              5 AI agents. One vision. Your game, built in months, not years.
            </p>
          </div>

          <div className="animate-fade-in-up stagger-2">
            <Button
              onClick={() => setShowNewProject(true)}
              size="lg"
              className="bg-gold hover:bg-gold/90 text-boss-bg font-bold text-lg px-10 py-6 cta-glow gap-2 transition-all duration-300"
            >
              Start Building
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Agent lineup */}
          <div className="mt-20 flex items-end justify-center gap-4 md:gap-6 animate-fade-in-up stagger-3">
            {AGENTS.map((agent, i) => (
              <div
                key={agent.name}
                className="flex flex-col items-center animate-float"
                style={{ animationDelay: `${i * 0.4}s` }}
              >
                <div
                  className="w-14 h-14 md:w-20 md:h-20 rounded-2xl border-2 flex items-center justify-center text-2xl md:text-4xl mb-2 transition-all duration-300 hover:scale-110"
                  style={{
                    borderColor: agent.color + "60",
                    backgroundColor: agent.color + "10",
                    boxShadow: `0 0 25px ${agent.glow}`,
                  }}
                >
                  {agent.icon}
                </div>
                <span className="text-xs font-bold" style={{ color: agent.color }}>
                  {agent.name}
                </span>
                <span className="text-[10px] text-text-muted hidden md:block">
                  {agent.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-text-muted/30 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-3 rounded-full bg-gold/50" />
          </div>
        </div>
      </section>

      {/* ────────── MEET YOUR TEAM ────────── */}
      <section id="team" className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.25em] text-agent-teal mb-3">Meet Your Team</p>
            <h2 className="text-4xl md:text-5xl font-black text-text-primary tracking-tight">
              Five Minds. One Mission.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {AGENTS.map((agent) => (
              <div
                key={agent.name}
                className="agent-card-glow group relative rounded-2xl border bg-boss-card/80 p-6 text-center overflow-hidden"
                style={{ borderColor: agent.color + "30" }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `radial-gradient(circle at center, ${agent.color}08 0%, transparent 70%)` }}
                />
                <div className="relative z-10">
                  <div
                    className="w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl mx-auto mb-4 transition-all duration-300 group-hover:scale-110"
                    style={{
                      borderColor: agent.color + "50",
                      backgroundColor: agent.color + "10",
                      boxShadow: `0 0 20px ${agent.glow}`,
                    }}
                  >
                    {agent.icon}
                  </div>
                  <h3 className="text-lg font-bold text-text-primary mb-0.5">{agent.name}</h3>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: agent.color }}>
                    {agent.role}
                  </p>
                  <p className="text-sm text-text-muted">{agent.line}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────── HOW IT WORKS ────────── */}
      <section className="py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-boss-surface/50 to-transparent" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.25em] text-agent-amber mb-3">How It Works</p>
            <h2 className="text-4xl md:text-5xl font-black text-text-primary tracking-tight">
              Three Steps to Your Game
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

      {/* ────────── FEATURES ────────── */}
      <section id="features" className="py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-boss-surface/50 to-transparent" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.25em] text-agent-green mb-3">Features</p>
            <h2 className="text-4xl md:text-5xl font-black text-text-primary tracking-tight">
              Everything You Need
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="feature-card rounded-2xl border border-boss-border bg-boss-card/60 p-7 group"
              >
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold text-text-primary mb-2">{f.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────── PRICING ────────── */}
      <section id="pricing" className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.25em] text-agent-violet mb-3">Pricing</p>
            <h2 className="text-4xl md:text-5xl font-black text-text-primary tracking-tight mb-4">
              Choose Your Plan
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl border p-6 ${
                  tier.highlighted
                    ? "border-gold/40 bg-boss-card pricing-popular"
                    : "border-boss-border bg-boss-card/60"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gold text-boss-bg text-xs font-bold">
                    Most Popular
                  </div>
                )}

                <h3 className="text-xl font-bold text-text-primary mb-2">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black text-text-primary">{tier.price}</span>
                  {tier.period && <span className="text-text-muted text-sm">{tier.period}</span>}
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-text-secondary">
                      <Check className="w-4 h-4 text-agent-green shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {tier.tierId ? (
                  <Button
                    variant={tier.highlighted ? "default" : "outline"}
                    className={`w-full ${
                      tier.highlighted
                        ? "bg-gold hover:bg-gold/90 text-boss-bg font-semibold"
                        : "border-boss-border text-text-secondary hover:text-text-primary"
                    }`}
                    disabled={!!checkoutTier}
                    onClick={() => handleCheckout(tier.tierId!)}
                  >
                    {checkoutTier === tier.tierId ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      `Get ${tier.name}`
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-boss-border text-text-muted cursor-default"
                    disabled
                  >
                    Current plan
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Waitlist */}
          <div className="mt-16 max-w-lg mx-auto text-center">
            <p className="text-text-secondary mb-4">
              Join the waitlist to get early access
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinWaitlist()}
                placeholder="you@email.com"
                className="flex-1 px-4 py-2.5 rounded-lg bg-boss-elevated border border-boss-border text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-gold/40 transition-colors"
              />
              <Button
                onClick={joinWaitlist}
                disabled={waitlistLoading || !waitlistEmail}
                className="bg-gold hover:bg-gold/90 text-boss-bg font-semibold gap-2"
              >
                {waitlistLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Join
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

      {/* Empty state for new users */}
      {!loading && projects.length === 0 && (
        <section className="py-24 px-6 border-t border-boss-border">
          <div className="max-w-7xl mx-auto text-center">
            <Sparkles className="w-12 h-12 text-gold/40 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-text-primary mb-2">Ready to build?</h3>
            <p className="text-text-muted mb-6">
              Create your first project and start commanding your AI team.
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
              Built with <span className="text-agent-rose">&#10084;</span> by Youns &mdash; &copy; 2025
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
