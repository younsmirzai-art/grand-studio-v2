import Link from "next/link";
import {
  Rocket,
  ArrowRight,
  Check,
  Terminal,
  KeyRound,
} from "lucide-react";

export function PluginSection() {
  return (
    <section className="gs-section-pro">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="gs-eyebrow mb-4">
              <Rocket className="w-3 h-3" />
              <span>UE5 Plugin</span>
            </div>

            <h2 className="gs-heading-lg mb-4">
              Grand Studio AI Commander for Unreal Engine.
            </h2>

            <p className="text-lg text-white/60 mb-6 leading-relaxed">
              Our companion plugin brings AI-powered world building right into
              UE 5.7. Describe scenes, generate cities, place assets — all from
              natural language.
            </p>

            <ul className="space-y-2 mb-8">
              {[
                "AI-powered city builder",
                "Natural language commands",
                "200+ AAA materials included",
                "One-click screenshot capture",
                "API key auth from your account",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm text-white/70"
                >
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/plugin" className="gs-btn gs-btn-primary gs-btn-lg">
                Learn more
                <ArrowRight className="w-4 h-4" />
              </Link>
              <div className="inline-flex items-center gap-2 px-5 py-3 text-sm text-white/50">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span>Coming to Fab Marketplace</span>
              </div>
            </div>
          </div>

          <div className="gs-mockup-frame">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-black/30">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-medium text-white/70">
                AI Commander
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Connected
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[10px] uppercase tracking-wider text-white/35 mb-1.5">
                  Prompt
                </div>
                <p className="text-sm text-white/80">
                  Create a rainy Tokyo street with neon signs and parked scooters.
                </p>
              </div>
              <div className="rounded-lg border border-white/8 bg-black/40 p-3 font-mono text-[11px] text-white/55 space-y-1">
                <div>
                  <span className="text-cyan-400">›</span> Resolving assets…
                </div>
                <div>
                  <span className="text-cyan-400">›</span> Placing 11 actors
                </div>
                <div>
                  <span className="text-green-400">✓</span> Done in 1.8s
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-white/40">
                <KeyRound className="w-3.5 h-3.5 text-white/30" />
                Authenticated with Grand Studio API key
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
