"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  Zap,
  CheckCircle,
  MessageSquare,
  Package,
  Eye,
  Download,
  Code,
  Play,
  Menu,
  X,
  Check,
  ArrowRight,
  MapPin,
  Settings,
  Rocket,
  Gamepad2,
} from "lucide-react";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { STRIPE_PRICES } from "@/lib/stripe/config";

/* ------------------------------------------------------------------ */
/*  Animated section wrapper                                          */
/* ------------------------------------------------------------------ */
function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 48 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */
const PILLARS = [
  {
    icon: MessageSquare,
    title: "AI Co-Pilot",
    desc: "Chat with AI in plain English. It generates complete UE5 Python scripts and executes them directly in your editor.",
    features: [
      "Natural language to code",
      "Auto-execute in UE5",
      "Smart error recovery",
      "Live code streaming",
    ],
  },
  {
    icon: Package,
    title: "Smart Asset Library",
    desc: "AI selects from hundreds of professional meshes and materials. Real architecture, real vegetation, real textures.",
    features: [
      "Starter Content + Megascans",
      "5 scene templates",
      "AI auto-selects assets",
      "Category browsing",
    ],
  },
  {
    icon: Eye,
    title: "Visual Feedback Loop",
    desc: "See what AI built via automatic screenshots. AI scores the result and fixes issues. You refine with natural language.",
    features: [
      "Auto-screenshot capture",
      "AI vision scoring 1-10",
      "Natural language refinement",
      "Up to 3 auto-fix rounds",
    ],
  },
];

const STEPS = [
  {
    num: "01",
    icon: Download,
    title: "DOWNLOAD",
    desc: "Download the free relay bridge for Windows. One small file connects Grand Studio to your Unreal Engine.",
    ctaLabel: "Download for Windows",
    ctaHref: "/api/relay/setup-script",
  },
  {
    num: "02",
    icon: Play,
    title: "OPEN UE5",
    desc: "Open Unreal Engine 5, go to Edit > Plugins, enable Web Remote Control, restart UE5.",
  },
  {
    num: "03",
    icon: MessageSquare,
    title: "DESCRIBE",
    desc: "Tell the AI what you want to build. A castle, a forest, a city, anything you can imagine.",
  },
  {
    num: "04",
    icon: Code,
    title: "BUILD",
    desc: "AI writes Python code, imports real 3D models from Poly Haven and Sketchfab, and builds your scene live.",
  },
];

const FREE_FEATURES = [
  "10 AI messages per day",
  "5 Poly Haven imports per day",
  "3 Sketchfab imports per day",
  "2 projects",
  "5 screenshots per day",
  "Community support",
];

const PRO_FEATURES = [
  "Unlimited AI messages",
  "Unlimited Poly Haven imports",
  "Unlimited Sketchfab imports",
  "10 projects",
  "Unlimited screenshots",
  "Powered by Claude Opus 4.6",
  "Email support",
];

const TEAM_FEATURES = [
  "Everything in Pro",
  "Unlimited projects",
  "Up to 5 team members",
  "Powered by Claude Opus 4.6",
  "Priority email support",
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function HomePage() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleUpgradePro = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: STRIPE_PRICES.pro }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (res.status === 401) {
        router.push("/auth/login?redirectTo=/dashboard");
        return;
      }
      if (data.error) alert(data.error);
    } finally {
      setCheckoutLoading(false);
    }
  };

  useEffect(() => {
    createAuthClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data?.user) router.push("/dashboard");
      });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white overflow-x-hidden">
      {/* ============================================================ */}
      {/*  SECTION 1 — NAVBAR                                         */}
      {/* ============================================================ */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-[#0A0A0B]/80 backdrop-blur-xl border-b border-white/5 z-50">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-sm bg-[#2196F3]" />
            <span className="text-sm font-bold tracking-[0.2em] uppercase text-white">
              Grand Studio
            </span>
          </Link>

          {/* Center links — desktop */}
          <div className="hidden md:flex items-center gap-8 text-sm text-[#A0A0A8]">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>

          {/* Right — desktop */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/auth/login" className="text-sm text-[#A0A0A8] hover:text-white transition-colors">
              Login
            </Link>
            <Link
              href="/auth/signup"
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white hover:brightness-110 transition epic-cta-glow"
            >
              GET STARTED
            </Link>
          </div>

          {/* Hamburger — mobile */}
          <button
            className="md:hidden text-[#A0A0A8] hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[#0A0A0B]/95 backdrop-blur-xl border-b border-white/5 px-6 pb-6 pt-2 space-y-4">
            <a href="#features" onClick={() => setMobileOpen(false)} className="block text-sm text-[#A0A0A8] hover:text-white">Features</a>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="block text-sm text-[#A0A0A8] hover:text-white">How It Works</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)} className="block text-sm text-[#A0A0A8] hover:text-white">Pricing</a>
            <hr className="border-white/5" />
            <Link href="/auth/login" className="block text-sm text-[#A0A0A8]">Login</Link>
            <Link href="/auth/signup" className="block text-center px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white">
              GET STARTED
            </Link>
          </div>
        )}
      </nav>

      {/* ============================================================ */}
      {/*  SECTION 2 — HERO                                           */}
      {/* ============================================================ */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 px-4">
        {/* Backgrounds */}
        <div className="absolute inset-0 epic-dot-grid" />
        <div className="absolute inset-0 epic-spotlight" />
        <div className="absolute inset-0 epic-bottom-fade" />

        <div className="relative z-10 w-full max-w-6xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2196F3]/10 border border-[#2196F3]/20 mb-8"
          >
            <Zap className="w-4 h-4 text-[#2196F3]" />
            <span className="text-xs font-medium text-[#2196F3] tracking-wide">
              Powered by Unreal Engine 5
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-5xl md:text-7xl font-black tracking-tighter bg-gradient-to-r from-white via-white to-[#2196F3] bg-clip-text text-transparent leading-[1.1] mb-6"
          >
            THE AI CO-PILOT
            <br />
            FOR UNREAL ENGINE
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-xl text-[#A0A0A8] max-w-2xl mx-auto mt-6 leading-relaxed"
          >
            Build professional UE5 scenes 10x faster. Describe what you want,
            AI writes the code, Unreal Engine builds it live.
          </motion.p>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10"
          >
            <Link
              href="/auth/signup"
              className="px-8 py-3.5 rounded-lg text-sm font-bold bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white hover:brightness-110 transition epic-cta-glow flex items-center gap-2"
            >
              START BUILDING
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button className="px-8 py-3.5 rounded-lg text-sm font-semibold border border-white/20 text-white hover:bg-white/10 transition">
              WATCH DEMO
            </button>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="flex items-center justify-center gap-6 mt-8"
          >
            {["Free to Start", "No Credit Card", "UE5 Compatible"].map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-xs text-[#606068]">
                <CheckCircle className="w-3.5 h-3.5 text-[#606068]" />
                {t}
              </span>
            ))}
          </motion.div>

          {/* Product mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mt-16 max-w-5xl mx-auto"
          >
            <div
              className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
              style={{ transform: "perspective(1200px) rotateX(5deg)" }}
            >
              <div className="grid grid-cols-1 md:grid-cols-[340px_1fr]">
                {/* Chat panel */}
                <div className="bg-[#111114] p-6 border-r border-white/5 hidden md:block">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-2 h-2 rounded-full bg-[#2196F3]" />
                    <span className="text-xs font-semibold text-[#A0A0A8] uppercase tracking-wider">AI Chat</span>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-[#1A1A1F] rounded-xl p-3">
                      <p className="text-xs text-[#A0A0A8]">Build a medieval castle with stone walls, towers, and a moat around it</p>
                    </div>
                    <div className="bg-[#2196F3]/10 border border-[#2196F3]/20 rounded-xl p-3">
                      <p className="text-xs text-[#2196F3]">Generating UE5 scene... 3 actors placed</p>
                    </div>
                    <div className="bg-[#1A1A1F] rounded-xl p-3">
                      <p className="text-xs text-[#A0A0A8]">Add torches on the walls and fog</p>
                    </div>
                    <div className="bg-[#2196F3]/10 border border-[#2196F3]/20 rounded-xl p-3">
                      <p className="text-xs text-[#2196F3]">Adding 8 torches and volumetric fog...</p>
                    </div>
                  </div>
                  <div className="mt-6 h-10 rounded-lg bg-[#1A1A1F] border border-white/5 flex items-center px-3">
                    <span className="text-xs text-[#606068]">Describe your scene...</span>
                  </div>
                </div>
                {/* Viewport panel */}
                <div className="bg-[#0A0A0B] p-6 min-h-[280px] md:min-h-[360px] flex flex-col items-center justify-center relative">
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-[#606068] uppercase tracking-wider">UE5 Connected</span>
                  </div>
                  <div className="w-full max-w-md">
                    <div className="aspect-video rounded-lg bg-gradient-to-br from-[#111114] to-[#1A1A1F] border border-white/5 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto rounded-xl bg-[#2196F3]/10 border border-[#2196F3]/20 flex items-center justify-center mb-3">
                          <Play className="w-5 h-5 text-[#2196F3]" />
                        </div>
                        <p className="text-xs text-[#606068]">3D Viewport Preview</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SECTION 3 — THREE PILLARS                                   */}
      {/* ============================================================ */}
      <Section id="features" className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2196F3] text-xs uppercase tracking-[0.3em] mb-4">— CAPABILITIES</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white">Three Powerful Engines.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="group bg-[#111114]/80 backdrop-blur-xl border border-white/5 hover:border-[#2196F3]/30 rounded-2xl p-8 transition-all duration-300"
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2196F3]/20 to-[#00BCD4]/20 border border-[#2196F3]/20 flex items-center justify-center mb-5">
                  <p.icon className="w-6 h-6 text-[#2196F3]" />
                </div>

                <h3 className="text-lg font-bold text-white mb-2">{p.title}</h3>
                <p className="text-sm text-[#A0A0A8] leading-relaxed mb-6">{p.desc}</p>

                {/* Feature list */}
                <ul className="space-y-2.5 mb-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[#A0A0A8]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00BCD4] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Gradient separator */}
                <div className="h-px bg-gradient-to-r from-transparent via-[#2196F3]/30 to-transparent" />
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SECTION 4 — HOW IT WORKS                                    */}
      {/* ============================================================ */}
      <Section id="how-it-works" className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2196F3] text-xs uppercase tracking-[0.3em] mb-4">— WORKFLOW</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white">From Idea to Scene in Minutes.</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {/* Connector lines (desktop) */}
            <div className="hidden lg:block absolute top-16 left-[18%] right-[18%] h-px bg-gradient-to-r from-[#2196F3]/40 via-[#00BCD4]/40 to-[#2196F3]/40" />

            {STEPS.map((s) => (
              <div key={s.num} className="text-center relative">
                <span className="text-[#2196F3] font-mono text-sm font-bold">{s.num}</span>
                <div className="w-16 h-16 mx-auto mt-3 mb-5 rounded-full bg-[#2196F3]/10 border border-[#2196F3]/20 flex items-center justify-center relative z-10">
                  <s.icon className="w-7 h-7 text-[#2196F3]" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">{s.title}</h3>
                <p className="text-sm text-[#A0A0A8] leading-relaxed mb-3">{s.desc}</p>
                {"ctaHref" in s && s.ctaHref && "ctaLabel" in s && s.ctaLabel && (
                  <a
                    href={s.ctaHref}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2196F3]/20 border border-[#2196F3]/40 text-[#2196F3] hover:bg-[#2196F3]/30 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {s.ctaLabel}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SECTION 5 — STATS BAR                                       */}
      {/* ============================================================ */}
      <Section className="bg-[#111114] border-y border-white/5 py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-12 text-center">
          {[
            { value: "10x", label: "Faster Scene Building" },
            { value: "200+", label: "Professional Assets" },
            { value: "30sec", label: "Average Build Time" },
          ].map((s) => (
            <div key={s.value}>
              <p className="text-5xl font-black text-[#2196F3]">{s.value}</p>
              <p className="text-sm text-[#A0A0A8] mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SECTION 7 — PRICING                                         */}
      {/* ============================================================ */}
      <Section id="pricing" className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2196F3] text-xs uppercase tracking-[0.3em] mb-4">— PRICING</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Start Free. Scale When Ready.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="rounded-2xl border border-[#2A2A30] bg-[#111114] p-8">
              <h3 className="text-xl font-bold text-white mb-1">Free</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-black text-white">$0</span>
                <span className="text-sm text-[#606068]">/mo</span>
              </div>
              <ul className="space-y-3 mb-8">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-[#A0A0A8]">
                    <Check className="w-4 h-4 text-[#00BCD4] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className="block text-center w-full py-3 rounded-lg text-sm font-semibold border border-white/20 text-white hover:bg-white/10 transition"
              >
                GET STARTED FREE
              </Link>
            </div>

            {/* Pro — Popular */}
            <div className="relative rounded-2xl border border-[#2196F3]/40 bg-[#111114] p-8 pricing-popular">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#2196F3] text-white text-xs font-bold uppercase tracking-wider">
                Popular
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Pro</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-black text-white">$19</span>
                <span className="text-sm text-[#606068]">/mo</span>
              </div>
              <ul className="space-y-3 mb-8">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-[#A0A0A8]">
                    <Check className="w-4 h-4 text-[#2196F3] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleUpgradePro}
                disabled={checkoutLoading}
                className="block text-center w-full py-3 rounded-lg text-sm font-bold bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white hover:brightness-110 transition disabled:opacity-50"
              >
                {checkoutLoading ? "Redirecting…" : "UPGRADE TO PRO"}
              </button>
            </div>

            {/* Team */}
            <div className="rounded-2xl border border-[#2A2A30] bg-[#111114] p-8">
              <h3 className="text-xl font-bold text-white mb-1">Team</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-black text-white">$49</span>
                <span className="text-sm text-[#606068]">/mo</span>
              </div>
              <ul className="space-y-3 mb-8">
                {TEAM_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-[#A0A0A8]">
                    <Check className="w-4 h-4 text-[#00BCD4] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="mailto:team@grandstudio.app"
                className="block text-center w-full py-3 rounded-lg text-sm font-semibold border border-white/20 text-white hover:bg-white/10 transition"
              >
                CONTACT US
              </a>
            </div>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SECTION 8 — GET STARTED                                     */}
      {/* ============================================================ */}
      <Section id="get-started" className="py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#2196F3] text-xs uppercase tracking-[0.3em] mb-4">— GET STARTED</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Three Steps to Your First Scene</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-2xl border border-white/5 bg-[#111114]/50 hover:border-[#2196F3]/20 transition">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-[#2196F3]/10 border border-[#2196F3]/20 flex items-center justify-center">
                <Download className="w-7 h-7 text-[#2196F3]" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">1. Download the Relay</h3>
              <p className="text-sm text-[#A0A0A8] mb-4">One-click setup for Windows. Connects Grand Studio to UE5.</p>
              <a
                href="/api/relay/setup-script"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2196F3]/20 border border-[#2196F3]/40 text-[#2196F3] hover:bg-[#2196F3]/30 transition"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            </div>

            <div className="text-center p-6 rounded-2xl border border-white/5 bg-[#111114]/50 hover:border-[#2196F3]/20 transition">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-[#2196F3]/10 border border-[#2196F3]/20 flex items-center justify-center">
                <Settings className="w-7 h-7 text-[#2196F3]" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">2. Enable UE5 Plugin</h3>
              <p className="text-sm text-[#A0A0A8]">Edit &gt; Plugins &rarr; enable Web Remote Control, then restart UE5.</p>
            </div>

            <div className="text-center p-6 rounded-2xl border border-white/5 bg-[#111114]/50 hover:border-[#2196F3]/20 transition">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-[#2196F3]/10 border border-[#2196F3]/20 flex items-center justify-center">
                <Rocket className="w-7 h-7 text-[#2196F3]" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">3. Start Building</h3>
              <p className="text-sm text-[#A0A0A8] mb-4">Create an account and describe your first scene in plain English.</p>
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white hover:brightness-110 transition"
              >
                Sign up free
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SECTION 9 — FINAL CTA                                       */}
      {/* ============================================================ */}
      <Section className="py-32 px-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(33,150,243,0.12)_0%,_transparent_70%)]" />
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <h2 className="text-5xl font-black text-white mb-6">Ready to Build?</h2>
          <p className="text-lg text-[#A0A0A8] mb-10 max-w-xl mx-auto">
            Join hundreds of developers building UE5 scenes with AI. No credit card required.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-lg text-base font-bold bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white hover:brightness-110 transition epic-cta-glow"
          >
            START BUILDING FOR FREE
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-xs text-[#606068] mt-6">No credit card required</p>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SECTION 9 — FOOTER                                          */}
      {/* ============================================================ */}
      <footer className="border-t border-white/5 pt-16 pb-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            {/* Col 1 — Logo */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-3 h-3 rounded-sm bg-[#2196F3]" />
                <span className="text-sm font-bold tracking-[0.2em] uppercase text-white">Grand Studio</span>
              </div>
              <p className="text-sm text-[#A0A0A8] leading-relaxed max-w-xs">
                The AI co-pilot for Unreal Engine 5. Build professional scenes faster than ever with natural language.
              </p>
            </div>

            {/* Col 2 — Links */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li>
                  <a href="#features" className="text-sm text-[#A0A0A8] hover:text-white transition-colors">Features</a>
                </li>
                <li>
                  <a href="#pricing" className="text-sm text-[#A0A0A8] hover:text-white transition-colors">Pricing</a>
                </li>
                <li>
                  <Link href="/connect" className="text-sm text-[#A0A0A8] hover:text-white transition-colors">Documentation</Link>
                </li>
              </ul>
            </div>

            {/* Col 3 — Epic Games sign-in */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Sign in</h4>
              <div className="flex items-center gap-2 text-sm text-[#A0A0A8] mb-4">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>Built for Unreal Engine creators</span>
              </div>
              <Link
                href="/auth/epic"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A1A1F] border border-white/10 text-sm text-white hover:bg-white/10 hover:border-[#2196F3]/30 transition"
              >
                <Gamepad2 className="w-4 h-4 text-[#2196F3]" />
                Sign in with Epic Games
              </Link>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#606068]">&copy; 2026 Grand Studio. All rights reserved.</p>
            <div className="flex items-center gap-6 text-xs text-[#606068]">
              <Link href="/privacy" className="hover:text-[#A0A0A8] transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-[#A0A0A8] transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
