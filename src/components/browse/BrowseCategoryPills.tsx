"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PolyHavenCategory } from "@/lib/polyhaven/client";

export function BrowseCategoryPills({
  categories,
}: {
  categories: PolyHavenCategory[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = searchParams.get("categories")?.split(",").filter(Boolean) ?? [];
  const pills = categories.slice(0, 8);

  const toggle = useCallback(
    (slug: string) => {
      const next = selected.includes(slug)
        ? selected.filter((item) => item !== slug)
        : [...selected, slug];
      const params = new URLSearchParams(searchParams.toString());
      if (next.length === 0) params.delete("categories");
      else params.set("categories", next.join(","));
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, selected]
  );

  if (pills.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {pills.map((category) => {
        const active = selected.includes(category.slug);
        return (
          <button
            key={category.slug}
            type="button"
            onClick={() => toggle(category.slug)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ease-in-out ${
              active
                ? "border-[#5E6AD2]/50 bg-[#5E6AD2]/15 text-slate-100"
                : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-100 hover:border-white/20"
            }`}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
