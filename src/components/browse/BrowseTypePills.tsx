"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const TYPES = [
  { slug: "all", name: "All" },
  { slug: "models", name: "Models" },
  { slug: "textures", name: "Textures" },
  { slug: "hdris", name: "HDRIs" },
] as const;

export function BrowseTypePills() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = searchParams.get("type") || "all";

  const setType = useCallback(
    (slug: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (slug === "all") params.delete("type");
      else params.set("type", slug);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {TYPES.map((item) => {
        const active = selected === item.slug;
        return (
          <button
            key={item.slug}
            type="button"
            onClick={() => setType(item.slug)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ease-in-out ${
              active
                ? "border-[#5E6AD2]/50 bg-[#5E6AD2]/15 text-slate-100"
                : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-100 hover:border-white/20"
            }`}
          >
            {item.name}
          </button>
        );
      })}
    </div>
  );
}
