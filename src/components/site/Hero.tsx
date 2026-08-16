import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Sparkles,
  Check,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  Download,
  Lock,
} from "lucide-react";
import { getPolyHavenAssets, type Model } from "@/lib/polyhaven/client";

const FILTERS = ["All", "Nature", "Props", "Architecture", "Vehicles"];

export async function Hero() {
  const models = await getPolyHavenAssets({ type: "models", limit: 6 });

  return (
    <section className="relative pt-28 pb-16 md:pt-36 md:pb-28 overflow-hidden">
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
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-14 items-center">
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
              <Link href="/auth/signup" className="gs-btn gs-btn-primary gs-btn-lg">
                Start free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/browse" className="gs-btn gs-btn-secondary gs-btn-lg">
                Browse models
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/50 mb-8">
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
                <span>10,000+ assets</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-md">
              {[
                { value: "10K+", label: "Assets indexed" },
                { value: "3", label: "Sources" },
                { value: "10/day", label: "Free downloads" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3"
                >
                  <div className="font-display font-semibold text-white text-lg leading-none mb-1">
                    {stat.value}
                  </div>
                  <div className="text-[11px] text-white/40">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <ProductMockup models={models} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductMockup({ models }: { models: Model[] }) {
  const cards =
    models.length >= 6
      ? models.slice(0, 6)
      : [
          ...models,
          ...Array.from({ length: Math.max(0, 6 - models.length) }, (_, i) => ({
            id: `placeholder-${i}`,
            name: "Loading…",
            thumbnail: "",
            source: "Poly Haven",
            downloads: 0,
            isFree: true,
            categories: [] as string[],
            tags: [] as string[],
          })),
        ];

  return (
    <div className="relative">
      {/* Soft ambient glow behind the frame */}
      <div
        className="absolute -inset-6 rounded-[28px] blur-2xl opacity-60 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(124,58,237,0.35), transparent 55%), radial-gradient(circle at 80% 80%, rgba(0,212,255,0.2), transparent 50%)",
        }}
      />

      {/* Floating status pill */}
      <div className="absolute -top-3 -left-3 z-20 hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-[var(--gs-bg-surface)]/95 backdrop-blur px-3 py-1.5 shadow-xl">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        <span className="text-[11px] font-medium text-white/80">
          Live catalog
        </span>
      </div>

      {/* Floating source badge */}
      <div className="absolute -bottom-3 -right-2 z-20 hidden sm:flex items-center gap-2 rounded-lg border border-white/10 bg-[var(--gs-bg-surface)]/95 backdrop-blur px-3 py-2 shadow-xl">
        <Lock className="w-3.5 h-3.5 text-cyan-400" />
        <div>
          <div className="text-[11px] font-medium text-white">CC0 ready</div>
          <div className="text-[10px] text-white/40">Commercial use OK</div>
        </div>
      </div>

      <div className="gs-mockup-frame relative z-10">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5 bg-black/30">
          <div className="flex items-center gap-1.5 pl-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 mx-2 h-7 rounded-md bg-white/[0.04] border border-white/8 flex items-center gap-2 px-2.5">
            <Lock className="w-3 h-3 text-white/25" />
            <span className="text-[11px] text-white/45 truncate">
              grandstudio.dev/browse
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <div className="h-6 px-2 rounded bg-white/5 border border-white/8 text-[10px] text-white/50 flex items-center">
              Browse
            </div>
            <div className="h-6 px-2 rounded text-[10px] text-white/30 flex items-center">
              Library
            </div>
          </div>
        </div>

        <div className="flex min-h-[340px] md:min-h-[380px]">
          {/* Mini sidebar */}
          <aside className="hidden sm:flex w-[132px] flex-col border-r border-white/5 bg-black/20 p-3 gap-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="gs-mark w-6 h-6 text-[9px] rounded-md">GS</div>
              <span className="text-[10px] font-semibold text-white/80">
                Filters
              </span>
            </div>

            <div>
              <div className="text-[9px] uppercase tracking-wider text-white/30 mb-1.5 px-1">
                Category
              </div>
              <div className="space-y-0.5">
                {["All models", "Nature", "Props", "Vehicles", "Architecture"].map(
                  (item, i) => (
                    <div
                      key={item}
                      className={`rounded-md px-2 py-1.5 text-[10px] ${
                        i === 0
                          ? "bg-white/8 text-white"
                          : "text-white/45 hover:text-white/70"
                      }`}
                    >
                      {item}
                    </div>
                  )
                )}
              </div>
            </div>

            <div>
              <div className="text-[9px] uppercase tracking-wider text-white/30 mb-1.5 px-1">
                Source
              </div>
              <div className="space-y-1.5 px-1">
                {["Poly Haven", "Sketchfab", "Meshy"].map((source) => (
                  <div
                    key={source}
                    className="flex items-center gap-1.5 text-[10px] text-white/50"
                  >
                    <div className="w-2.5 h-2.5 rounded-sm border border-white/20 bg-white/5" />
                    {source}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto rounded-lg border border-white/8 bg-white/[0.03] p-2">
              <div className="text-[9px] text-white/40 mb-1">Plan</div>
              <div className="text-[10px] font-medium text-white">Free · 7/10</div>
              <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full w-[70%] rounded-full bg-[#5E6AD2]" />
              </div>
            </div>
          </aside>

          {/* Main panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Toolbar */}
            <div className="p-3 border-b border-white/5 space-y-2.5">
              <div className="h-8 rounded-md bg-white/[0.04] border border-white/10 flex items-center gap-2 px-2.5">
                <Search className="w-3.5 h-3.5 text-white/35" />
                <span className="text-[11px] text-white/40 flex-1 truncate">
                  Search 10,000+ models, textures, HDRIs...
                </span>
                <kbd className="hidden md:inline text-[9px] text-white/25 border border-white/10 rounded px-1">
                  ⌘K
                </kbd>
              </div>

              <div className="flex items-center gap-1.5 overflow-hidden">
                {FILTERS.map((filter, i) => (
                  <span
                    key={filter}
                    className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-medium ${
                      i === 0
                        ? "bg-white text-black"
                        : "bg-white/5 text-white/50 border border-white/8"
                    }`}
                  >
                    {filter}
                  </span>
                ))}
                <div className="ml-auto flex items-center gap-1.5 text-white/35">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <LayoutGrid className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Results meta */}
            <div className="px-3 pt-2.5 flex items-center justify-between text-[10px] text-white/40">
              <span>2,418 results · Sorted by Popular</span>
              <span className="text-cyan-400/80">Updated just now</span>
            </div>

            {/* Model grid with real thumbnails */}
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1">
              {cards.map((model) => (
                <div
                  key={model.id}
                  className="rounded-lg border border-white/8 bg-white/[0.03] overflow-hidden"
                >
                  <div className="relative aspect-[4/3] bg-black/40">
                    {model.thumbnail ? (
                      <Image
                        src={model.thumbnail}
                        alt={model.name}
                        fill
                        className="object-cover"
                        sizes="160px"
                        unoptimized
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-cyan-500/20" />
                    )}
                    {model.isFree && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase bg-green-500/20 text-green-300 border border-green-500/30">
                        Free
                      </span>
                    )}
                  </div>
                  <div className="px-2 py-1.5">
                    <div className="text-[10px] font-medium text-white truncate">
                      {model.name}
                    </div>
                    <div className="flex items-center justify-between mt-0.5 text-[9px] text-white/40">
                      <span className="truncate">{model.source}</span>
                      {model.downloads > 0 && (
                        <span className="flex items-center gap-0.5 shrink-0">
                          <Download className="w-2.5 h-2.5" />
                          {model.downloads > 999
                            ? `${Math.round(model.downloads / 1000)}k`
                            : model.downloads}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
