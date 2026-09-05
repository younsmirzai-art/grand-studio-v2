"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  Download,
  Lock,
  Sparkles,
} from "lucide-react";
import type { Model } from "@/lib/polyhaven/client";

const FILTERS = ["All", "Nature", "Props", "Architecture", "Vehicles"];
const SEARCH_DEMOS = [
  "cyberpunk motorcycle",
  "ancient oak tree",
  "sci-fi corridor",
  "leather armchair",
  "desert HDRI",
];

interface HeroLiveCatalogProps {
  models: Model[];
}

export function HeroLiveCatalog({ models }: HeroLiveCatalogProps) {
  const [queryIndex, setQueryIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [activeFilter, setActiveFilter] = useState(0);
  const [downloadPulse, setDownloadPulse] = useState(7);
  const [spotlight, setSpotlight] = useState(0);

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

  useEffect(() => {
    const full = SEARCH_DEMOS[queryIndex % SEARCH_DEMOS.length];
    let i = 0;
    setTyped("");
    const typeTimer = window.setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) window.clearInterval(typeTimer);
    }, 55);
    const nextTimer = window.setTimeout(() => {
      setQueryIndex((v) => v + 1);
    }, full.length * 55 + 1600);
    return () => {
      window.clearInterval(typeTimer);
      window.clearTimeout(nextTimer);
    };
  }, [queryIndex]);

  useEffect(() => {
    const filterTimer = window.setInterval(() => {
      setActiveFilter((v) => (v + 1) % FILTERS.length);
    }, 2800);
    const pulseTimer = window.setInterval(() => {
      setDownloadPulse((v) => (v >= 10 ? 3 : v + 1));
    }, 2200);
    const spotTimer = window.setInterval(() => {
      setSpotlight((v) => (v + 1) % 6);
    }, 1800);
    return () => {
      window.clearInterval(filterTimer);
      window.clearInterval(pulseTimer);
      window.clearInterval(spotTimer);
    };
  }, []);

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -inset-6 rounded-[28px] opacity-70 blur-2xl"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(94,106,210,0.4), transparent 55%), radial-gradient(circle at 80% 80%, rgba(0,212,255,0.22), transparent 50%)",
        }}
      />

      <div className="absolute -top-3 -left-3 z-20 hidden items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 shadow-xl backdrop-blur sm:flex">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="text-[11px] font-medium text-emerald-200">
          Live catalog · updating
        </span>
      </div>

      <div className="absolute -bottom-3 -right-2 z-20 hidden items-center gap-2 rounded-lg border border-white/10 bg-[var(--gs-bg-surface)]/95 px-3 py-2 shadow-xl backdrop-blur sm:flex">
        <Sparkles className="h-3.5 w-3.5 text-[#A5B4FC]" />
        <div>
          <div className="text-[11px] font-medium text-white">
            Found in 0.4s
          </div>
          <div className="text-[10px] text-white/40">across 3 sources</div>
        </div>
      </div>

      <div className="gs-mockup-frame relative z-10">
        <div className="flex items-center gap-2 border-b border-white/5 bg-black/30 px-3 py-2.5">
          <div className="flex items-center gap-1.5 pl-1">
            <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          </div>
          <div className="mx-2 flex h-7 flex-1 items-center gap-2 rounded-md border border-white/8 bg-white/[0.04] px-2.5">
            <Lock className="h-3 w-3 text-white/25" />
            <span className="truncate text-[11px] text-white/45">
              grandstudio.dev/browse
            </span>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <div className="flex h-6 items-center rounded bg-white/5 px-2 text-[10px] text-white/50 border border-white/8">
              Browse
            </div>
            <div className="flex h-6 items-center px-2 text-[10px] text-white/30">
              Library
            </div>
          </div>
        </div>

        <div className="flex min-h-[340px] md:min-h-[380px]">
          <aside className="hidden w-[132px] flex-col gap-3 border-r border-white/5 bg-black/20 p-3 sm:flex">
            <div className="mb-1 flex items-center gap-2">
              <div className="gs-mark h-6 w-6 rounded-md text-[9px]">GS</div>
              <span className="text-[10px] font-semibold text-white/80">
                Filters
              </span>
            </div>

            <div>
              <div className="mb-1.5 px-1 text-[9px] uppercase tracking-wider text-white/30">
                Category
              </div>
              <div className="space-y-0.5">
                {["All models", "Nature", "Props", "Vehicles", "Architecture"].map(
                  (item, i) => (
                    <div
                      key={item}
                      className={`rounded-md px-2 py-1.5 text-[10px] transition-colors duration-300 ${
                        i === activeFilter % 5
                          ? "bg-white/10 text-white"
                          : "text-white/45"
                      }`}
                    >
                      {item}
                    </div>
                  )
                )}
              </div>
            </div>

            <div>
              <div className="mb-1.5 px-1 text-[9px] uppercase tracking-wider text-white/30">
                Source
              </div>
              <div className="space-y-1.5 px-1">
                {["Poly Haven", "Sketchfab", "ambientCG"].map((source) => (
                  <div
                    key={source}
                    className="flex items-center gap-1.5 text-[10px] text-white/50"
                  >
                    <div className="h-2.5 w-2.5 rounded-sm border border-[#5E6AD2]/50 bg-[#5E6AD2]/30" />
                    {source}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto rounded-lg border border-white/8 bg-white/[0.03] p-2">
              <div className="mb-1 text-[9px] text-white/40">Free plan</div>
              <div className="text-[10px] font-medium text-white">
                {downloadPulse}/10 today
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-[#5E6AD2] transition-all duration-700"
                  style={{ width: `${downloadPulse * 10}%` }}
                />
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="space-y-2.5 border-b border-white/5 p-3">
              <div className="flex h-8 items-center gap-2 rounded-md border border-[#5E6AD2]/35 bg-white/[0.04] px-2.5 shadow-[0_0_24px_rgba(94,106,210,0.15)]">
                <Search className="h-3.5 w-3.5 text-[#A5B4FC]" />
                <span className="flex-1 truncate text-[11px] text-white/70">
                  {typed}
                  <span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-[#A5B4FC]" />
                </span>
                <kbd className="hidden rounded border border-white/10 px-1 text-[9px] text-white/25 md:inline">
                  ⌘K
                </kbd>
              </div>

              <div className="flex items-center gap-1.5 overflow-hidden">
                {FILTERS.map((filter, i) => (
                  <span
                    key={filter}
                    className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition-all duration-300 ${
                      i === activeFilter
                        ? "bg-white text-black"
                        : "border border-white/8 bg-white/5 text-white/50"
                    }`}
                  >
                    {filter}
                  </span>
                ))}
                <div className="ml-auto flex items-center gap-1.5 text-white/35">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <LayoutGrid className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-3 pt-2.5 text-[10px] text-white/40">
              <span>2,418 results · Sorted by Popular</span>
              <span className="text-[#A5B4FC]">Updated just now</span>
            </div>

            <div className="grid flex-1 grid-cols-2 gap-2 p-3 sm:grid-cols-3">
              {cards.map((model, index) => {
                const active = index === spotlight;
                return (
                  <Link
                    key={model.id}
                    href={
                      model.thumbnail ? `/model/${encodeURIComponent(model.id)}` : "/browse"
                    }
                    className={`group overflow-hidden rounded-lg border bg-white/[0.03] transition-all duration-500 ${
                      active
                        ? "border-[#5E6AD2]/60 scale-[1.03] shadow-[0_12px_40px_rgba(94,106,210,0.25)]"
                        : "border-white/8 hover:border-white/20"
                    }`}
                  >
                    <div className="relative aspect-[4/3] bg-black/40">
                      {model.thumbnail ? (
                        <Image
                          src={model.thumbnail}
                          alt={model.name}
                          fill
                          className={`object-cover transition-transform duration-700 ${
                            active ? "scale-110" : "group-hover:scale-105"
                          }`}
                          sizes="160px"
                          unoptimized
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#5E6AD2]/20 to-cyan-500/20" />
                      )}
                      {model.isFree && (
                        <span className="absolute left-1.5 top-1.5 rounded border border-emerald-500/30 bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-emerald-300">
                          Free
                        </span>
                      )}
                      {active ? (
                        <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] text-white backdrop-blur">
                          <Download className="h-2.5 w-2.5" />
                          Ready
                        </span>
                      ) : null}
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="truncate text-[10px] font-medium text-white">
                        {model.name}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[9px] text-white/40">
                        <span className="truncate">{model.source}</span>
                        {model.downloads > 0 && (
                          <span className="flex shrink-0 items-center gap-0.5">
                            <Download className="h-2.5 w-2.5" />
                            {model.downloads > 999
                              ? `${Math.round(model.downloads / 1000)}k`
                              : model.downloads}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
