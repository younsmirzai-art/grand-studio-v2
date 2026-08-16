"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpDown, Check } from "lucide-react";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "popular", label: "Most popular" },
  { value: "downloads", label: "Most downloaded" },
  { value: "name", label: "Name (A-Z)" },
] as const;

export function SortDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const currentSort = searchParams.get("sort") || "popular";
  const currentLabel =
    SORT_OPTIONS.find((o) => o.value === currentSort)?.label || "Most popular";

  function selectSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 transition whitespace-nowrap"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ArrowUpDown className="w-3.5 h-3.5 text-white/50" />
        <span className="hidden sm:inline text-white/50">Sort:</span>
        <span className="font-medium">{currentLabel}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1 w-52 gs-glass-strong rounded-lg border border-white/10 shadow-xl z-50 p-1"
              role="listbox"
            >
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={currentSort === option.value}
                  onClick={() => selectSort(option.value)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded text-sm text-white/80 hover:text-white hover:bg-white/5 transition text-left"
                >
                  <span>{option.label}</span>
                  {currentSort === option.value && (
                    <Check className="w-3.5 h-3.5 text-[#A5B4FC]" />
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
