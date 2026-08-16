import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Rocket,
  Terminal,
  KeyRound,
  Wand2,
  Camera,
  Layers,
} from "lucide-react";
import { FinalCTA } from "@/components/site/FinalCTA";

export const metadata: Metadata = {
  title: "UE5 Plugin — AI Commander",
  description:
    "Grand Studio AI Commander for Unreal Engine 5.7. Natural language world building, city generation, and asset workflows — coming to Fab.",
};

const features = [
  {
    icon: Wand2,
    title: "Natural language commands",
    body: "Describe a scene and let the plugin execute structured UE5 operations.",
  },
  {
    icon: Layers,
    title: "AI city builder",
    body: "Generate layouts, place assets, and iterate without leaving the editor.",
  },
  {
    icon: Camera,
    title: "One-click screenshots",
    body: "Capture editor views for iteration, review, and documentation.",
  },
  {
    icon: KeyRound,
    title: "Secure API key auth",
    body: "Connect with your Grand Studio API key — rotate anytime from Settings.",
  },
];

export default function PluginPage() {
  return (
    <div className="pt-28 pb-8">
      <section className="max-w-7xl mx-auto px-6 mb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="gs-eyebrow mb-4">
              <Rocket className="w-3 h-3" />
              <span>UE5 Plugin</span>
            </div>
            <h1 className="gs-heading-xl mb-5">
              AI Commander for Unreal Engine 5.7
            </h1>
            <p className="text-lg text-white/60 mb-8 leading-relaxed max-w-xl">
              Bring AI-powered world building into the editor. Describe scenes,
              generate cities, and place assets — then connect your Grand Studio
              account with a single API key.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link href="/auth/signup" className="gs-btn gs-btn-primary gs-btn-lg">
                Create free account
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/settings" className="gs-btn gs-btn-secondary gs-btn-lg">
                Get API key
              </Link>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/50">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              Coming to Fab Marketplace
            </div>
          </div>

          <PluginCommandMockup />
        </div>
      </section>

      <section className="gs-section-pro border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="gs-heading-lg mb-3">Built for production workflows</h2>
            <p className="text-white/55 max-w-2xl mx-auto">
              Designed for UE5 creators who want AI assistance without leaving the
              editor.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature) => (
              <div key={feature.title} className="gs-feature-card">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-purple-300" />
                </div>
                <h3 className="font-display font-semibold text-lg text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="gs-section-pro">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="gs-heading-lg text-center mb-10">What&apos;s included</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {[
              "AI-powered city builder",
              "Natural language command pipeline",
              "200+ AAA materials pack",
              "Preset library with save/load",
              "Screenshot capture tools",
              "Grand Studio API key authentication",
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 gs-feature-card py-3 px-4 text-sm text-white/75"
              >
                <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <FinalCTA />
    </div>
  );
}

function PluginCommandMockup() {
  return (
    <div className="gs-mockup-frame">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-black/30">
        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-xs font-medium text-white/70">
          AI Commander · Unreal Editor
        </span>
        <span className="ml-auto text-[10px] text-green-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          Connected
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[10px] uppercase tracking-wider text-white/35 mb-2">
            Prompt
          </div>
          <p className="text-sm text-white/80 leading-relaxed">
            Build a cyberpunk alley with neon signs, wet pavement, and two parked
            hover bikes.
          </p>
        </div>
        <div className="rounded-lg border border-white/8 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-white/55 space-y-1">
          <div>
            <span className="text-cyan-400">›</span> Planning layout…
          </div>
          <div>
            <span className="text-cyan-400">›</span> Spawning 14 props from catalog
          </div>
          <div>
            <span className="text-cyan-400">›</span> Applying materials{" "}
            <span className="text-white/30">M_Neon_Emissive</span>
          </div>
          <div>
            <span className="text-green-400">✓</span> Scene ready — 2.4s
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 gs-btn gs-btn-primary gs-btn-sm pointer-events-none">
            Run command
          </div>
          <div className="h-9 px-3 rounded-md border border-white/10 bg-white/5 text-xs text-white/50 flex items-center">
            Undo
          </div>
        </div>
      </div>
    </div>
  );
}
