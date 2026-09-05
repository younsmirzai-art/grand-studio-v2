import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { HeroBronzeStage } from "@/components/site/HeroBronzeStage";

export async function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 md:pt-32 md:pb-24">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at 30% 0%, black 0%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 30% 0%, black 0%, transparent 72%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem]"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, rgba(180,110,40,0.18), transparent 55%), radial-gradient(ellipse at 90% 10%, rgba(40,90,160,0.12), transparent 50%)",
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#fff6ed]/80">
            <Sparkles className="h-3 w-3 text-[#d4a86a]" />
            Universal 3D model hub
          </div>

          <h1 className="mb-6 max-w-xl font-display text-4xl font-semibold leading-[1.05] tracking-tight text-[#fff6ed] md:text-5xl lg:text-[3.5rem]">
            Find, preview, and download assets for every project.
          </h1>

          <p className="mb-8 max-w-xl text-base leading-relaxed text-slate-400 md:text-lg">
            Browse downloadable models, textures, and HDRIs from Sketchfab, Poly
            Haven, and ambientCG — then ship them into Unreal, Blender, Unity,
            and more.
          </p>

          <div className="mb-8 flex flex-col items-start gap-3 sm:flex-row">
            <Link href="/auth/signup" className="gs-btn gs-btn-primary gs-btn-lg">
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/browse" className="gs-btn gs-btn-secondary gs-btn-lg">
              Browse models
            </Link>
            <Link href="/auth/login" className="gs-btn gs-btn-ghost gs-btn-lg">
              Log in
            </Link>
          </div>

          <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-400" />
              <span>Free tier available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-400" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-400" />
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
                className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3 backdrop-blur"
              >
                <div className="mb-1 font-display text-lg font-semibold leading-none text-[#fff6ed]">
                  {stat.value}
                </div>
                <div className="text-[11px] text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div
            className="pointer-events-none absolute -inset-8 rounded-[2rem] opacity-70 blur-3xl"
            style={{
              background:
                "radial-gradient(circle at 40% 30%, rgba(180,100,35,0.28), transparent 55%), radial-gradient(circle at 80% 70%, rgba(50,100,180,0.18), transparent 50%)",
            }}
          />
          <div className="relative z-10">
            <HeroBronzeStage />
          </div>
          <p className="mt-4 text-center text-xs text-slate-500 lg:text-left">
            Cinematic 3D stage inspired by bronze metalwork — your catalog,
            pricing, and login stay right where they belong.
          </p>
        </div>
      </div>
    </section>
  );
}
