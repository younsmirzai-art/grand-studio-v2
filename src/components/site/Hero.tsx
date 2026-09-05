import Link from "next/link";
import { ArrowRight, Sparkles, Check } from "lucide-react";
import { getPolyHavenAssets } from "@/lib/polyhaven/client";
import { HeroLiveCatalog } from "@/components/site/HeroLiveCatalog";

export async function Hero() {
  const models = await getPolyHavenAssets({ type: "models", limit: 6 });

  return (
    <section className="relative overflow-hidden pt-28 pb-16 md:pt-36 md:pb-28">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
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
        className="pointer-events-none absolute inset-x-0 top-0 h-96"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(94, 106, 210, 0.18), transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-14">
          <div>
            <div className="gs-eyebrow mb-6">
              <Sparkles className="h-3 w-3" />
              <span>10,000+ assets · one search box</span>
            </div>

            <h1 className="gs-heading-xl mb-6">
              The universal 3D model hub for creators.
            </h1>

            <p className="mb-8 max-w-xl text-lg leading-relaxed text-white/60 md:text-xl">
              Browse and download 3D models from Poly Haven, Sketchfab, and more
              — all in one place. Built for game developers, artists, and 3D
              creators.
            </p>

            <div className="mb-8 flex flex-col items-start gap-3 sm:flex-row">
              <Link href="/auth/signup" className="gs-btn gs-btn-primary gs-btn-lg">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/browse" className="gs-btn gs-btn-secondary gs-btn-lg">
                Browse models
              </Link>
            </div>

            <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/50">
              <div className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-400" />
                <span>Free tier available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-400" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-400" />
                <span>10,000+ assets</span>
              </div>
            </div>

            <div className="grid max-w-md grid-cols-3 gap-3">
              {[
                { value: "10K+", label: "Assets indexed" },
                { value: "3", label: "Sources" },
                { value: "10/day", label: "Free downloads" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3"
                >
                  <div className="mb-1 font-display text-lg font-semibold leading-none text-white">
                    {stat.value}
                  </div>
                  <div className="text-[11px] text-white/40">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <HeroLiveCatalog models={models} />
          </div>
        </div>
      </div>
    </section>
  );
}
