import {
  Search,
  Sparkles,
  Download,
  Rocket,
  Zap,
  Layers,
  type LucideIcon,
} from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  badge?: string;
}

const features: Feature[] = [
  {
    icon: Search,
    title: "Universal search",
    description:
      "One search box, thousands of sources. Find exactly what you need across every major 3D marketplace.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
  {
    icon: Sparkles,
    title: "AI Generator",
    description:
      "Create custom 3D models from text prompts. Describe it, get it. Coming soon.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    badge: "NEW",
  },
  {
    icon: Download,
    title: "Instant downloads",
    description:
      "Direct downloads with proper licensing. FBX, OBJ, GLB, USD, and more formats supported.",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  {
    icon: Layers,
    title: "Every category",
    description:
      "Nature, architecture, vehicles, characters, sci-fi, fantasy. From lowpoly to hero assets.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  {
    icon: Rocket,
    title: "UE5 Plugin",
    description:
      "Bring AI-powered world building right into Unreal Engine 5.7. Coming to Fab Marketplace.",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    badge: "SOON",
  },
  {
    icon: Zap,
    title: "Free tier",
    description:
      "10 downloads per day, forever. No credit card. No trial period. Just start creating.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="gs-section-pro scroll-mt-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gs-eyebrow gs-eyebrow-cyan inline-flex mb-4">
            <span>Features</span>
          </div>
          <h2 className="gs-heading-lg mb-4">
            Everything you need in one place.
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Stop juggling multiple accounts and download managers. Grand Studio
            brings the 3D marketplace universe together.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <div key={feature.title} className="gs-feature-card">
              <div
                className={`w-11 h-11 rounded-xl ${feature.bg} border ${feature.border} flex items-center justify-center mb-4`}
              >
                <feature.icon className={`w-5 h-5 ${feature.color}`} />
              </div>

              <div className="flex items-start gap-2 mb-2">
                <h3 className="font-display font-semibold text-lg text-white">
                  {feature.title}
                </h3>
                {feature.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-bold uppercase tracking-wider">
                    {feature.badge}
                  </span>
                )}
              </div>

              <p className="text-sm text-white/60 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
