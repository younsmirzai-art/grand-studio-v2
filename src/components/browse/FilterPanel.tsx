"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FilterGroup } from "./FilterGroup";
import type { PolyHavenCategory } from "@/lib/polyhaven/client";

interface FilterPanelProps {
  categories: PolyHavenCategory[];
  /** When true, skip sticky sidebar chrome (used inside mobile drawer). */
  embedded?: boolean;
}

const SOURCES = [
  { slug: "polyhaven", name: "Poly Haven", count: null as number | null },
  {
    slug: "sketchfab",
    name: "Sketchfab",
    count: null as number | null,
    disabled: true,
  },
  {
    slug: "meshy",
    name: "Meshy",
    count: null as number | null,
    disabled: true,
  },
];

const LICENSES = [
  { slug: "cc0", name: "CC0 (Public Domain)" },
  { slug: "cc-by", name: "CC-BY", disabled: true },
  { slug: "royalty-free", name: "Royalty-free", disabled: true },
];

const FORMATS = [
  { slug: "fbx", name: "FBX" },
  { slug: "obj", name: "OBJ", disabled: true },
  { slug: "glb", name: "GLB / GLTF", disabled: true },
  { slug: "usd", name: "USD / USDZ", disabled: true },
  { slug: "blend", name: "Blender", disabled: true },
];

export function FilterPanel({ categories, embedded = false }: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getMultiValue = useCallback(
    (key: string): string[] =>
      searchParams.get(key)?.split(",").filter(Boolean) || [],
    [searchParams]
  );

  const toggleValue = useCallback(
    (key: string, value: string) => {
      const current = getMultiValue(key);
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];

      const params = new URLSearchParams(searchParams.toString());
      if (next.length === 0) {
        params.delete(key);
      } else {
        params.set(key, next.join(","));
      }
      // Reset pagination-related UX by keeping URL clean of offset
      params.delete("offset");

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [getMultiValue, router, pathname, searchParams]
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    const sort = searchParams.get("sort");
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const activeCount = ["categories", "sources", "licenses", "formats"].reduce(
    (sum, key) => sum + getMultiValue(key).length,
    0
  );

  const card = (
    <div className={embedded ? "p-0" : "gs-card p-5"}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-white">Filters</h3>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-white/50 hover:text-white transition"
          >
            Clear all ({activeCount})
          </button>
        )}
      </div>

      <FilterGroup
        label="Category"
        options={categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          count: c.count,
        }))}
        selected={getMultiValue("categories")}
        onToggle={(value) => toggleValue("categories", value)}
        maxVisible={8}
      />

      <FilterGroup
        label="Source"
        options={SOURCES}
        selected={getMultiValue("sources")}
        onToggle={(value) => toggleValue("sources", value)}
      />

      <FilterGroup
        label="License"
        options={LICENSES}
        selected={getMultiValue("licenses")}
        onToggle={(value) => toggleValue("licenses", value)}
      />

      <FilterGroup
        label="Format"
        options={FORMATS}
        selected={getMultiValue("formats")}
        onToggle={(value) => toggleValue("formats", value)}
      />
    </div>
  );

  if (embedded) return card;

  return (
    <div className="w-64 flex-shrink-0">
      <div className="sticky top-24">{card}</div>
    </div>
  );
}
