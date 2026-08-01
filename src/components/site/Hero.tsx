import Link from "next/link";
import { ArrowRight, Sparkles, Check } from "lucide-react";

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          maskImage:
            "radial-gradient(ellipse at center top, black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center top, black 0%, transparent 70%)",
        }}
      />

      <div
        className="absolute inset-x-0 top-0 h-96 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(124, 58, 237, 0.15), transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="gs-eyebrow mb-6">
              <Sparkles className="w-3 h-3" />
              <span>Launching AI Generator soon</span>
            </div>

            <h1 className="gs-heading-xl mb-6">
              The universal 3D model hub for creators.
            </h1>

            <p className="text-lg md:text-xl text-white/60 mb-8 max-w-xl leading-relaxed">
              Browse and download 3D models from Poly Haven, Sketchfab, and more
              — all in one place. Built for game developers, artists, and 3D
              creators.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-3 mb-8">
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white text-black font-semibold hover:bg-white/90 transition-colors"
              >
                Start free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/browse"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
              >
                Browse models
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/50">
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-green-400" />
                <span>Free tier available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-green-400" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-green-400" />
                <span>500K+ models</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <ProductMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductMockup() {
  return (
    <div className="gs-mockup-frame">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
        <div className="w-3 h-3 rounded-full bg-white/10" />
        <div className="w-3 h-3 rounded-full bg-white/10" />
        <div className="w-3 h-3 rounded-full bg-white/10" />
        <div className="flex-1 mx-3 h-6 rounded bg-white/5 flex items-center px-3">
          <span className="text-xs text-white/40">grandstudio.dev/browse</span>
        </div>
      </div>

      <div className="p-4 border-b border-white/5">
        <div className="h-9 rounded-md bg-white/5 border border-white/10 flex items-center px-3">
          <span className="text-xs text-white/40">
            Search 500K+ 3D models...
          </span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-white/5 border border-white/5 relative overflow-hidden"
          >
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, 
                  rgba(124, 58, 237, ${0.1 + i * 0.03}) 0%, 
                  rgba(0, 212, 255, ${0.1 + i * 0.03}) 100%
                )`,
              }}
            />
            <div className="absolute bottom-2 left-2 right-2">
              <div className="h-2 rounded bg-white/10 mb-1" />
              <div className="h-1.5 rounded bg-white/5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
