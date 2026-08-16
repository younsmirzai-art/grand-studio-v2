import { Search, Eye, Download, type LucideIcon } from "lucide-react";

const steps: {
  number: string;
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    number: "01",
    icon: Search,
    title: "Search or browse",
    description:
      "Enter what you need or explore by category. Unified search across 10,000+ models, textures, and HDRIs.",
  },
  {
    number: "02",
    icon: Eye,
    title: "Preview & compare",
    description:
      "Inspect thumbnails, categories, and source details before you download.",
  },
  {
    number: "03",
    icon: Download,
    title: "Download & create",
    description:
      "One-click download with clear licensing. Drop assets into your next project.",
  },
];

export function HowItWorks() {
  return (
    <section className="gs-section-pro border-y border-white/5 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gs-eyebrow inline-flex mb-4">
            <span>How it works</span>
          </div>
          <h2 className="gs-heading-lg mb-4">
            Get to your model in three steps.
          </h2>
          <p className="text-white/55 max-w-xl mx-auto">
            A clean path from search to download — no account juggling.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.number} className="relative gs-feature-card">
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[calc(100%+0.25rem)] w-[calc(100%-2rem)] h-px bg-white/8 pointer-events-none" />
              )}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-cyan-400" />
                </div>
                <span className="font-display font-bold text-sm text-white/30">
                  {step.number}
                </span>
              </div>
              <h3 className="font-display font-semibold text-xl text-white mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-white/55 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
