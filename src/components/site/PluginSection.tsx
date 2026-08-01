import Link from "next/link";
import { Rocket, ArrowRight, Check } from "lucide-react";

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
                "Preset library with save/load",
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
              <Link
                href="/plugin"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white text-black font-semibold hover:bg-white/90 transition-colors"
              >
                Learn more
                <ArrowRight className="w-4 h-4" />
              </Link>
              <div className="inline-flex items-center gap-2 px-5 py-3 text-sm text-white/50">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span>Coming to Fab Marketplace</span>
              </div>
            </div>
          </div>

          <div className="gs-mockup-frame p-8">
            <div className="aspect-video bg-white/[0.03] rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Rocket className="w-12 h-12 text-white/20 mx-auto mb-2" />
                <p className="text-sm text-white/40">
                  Plugin preview coming soon
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
