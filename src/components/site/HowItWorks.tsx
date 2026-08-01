import { Search, Eye, Download } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Search or browse",
    description:
      "Enter what you need or explore by category. Our unified search covers 500K+ models.",
  },
  {
    number: "02",
    icon: Eye,
    title: "Preview & compare",
    description:
      "View 3D previews, check specs, compare quality across sources before you commit.",
  },
  {
    number: "03",
    icon: Download,
    title: "Download & create",
    description:
      "One-click download with proper licensing. Use in your game, film, or design project.",
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-full w-full h-px bg-white/5 -translate-x-6 pointer-events-none" />
              )}

              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <span className="font-display font-bold text-2xl text-white/80">
                    {step.number}
                  </span>
                </div>

                <h3 className="font-display font-semibold text-xl text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-white/60 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
