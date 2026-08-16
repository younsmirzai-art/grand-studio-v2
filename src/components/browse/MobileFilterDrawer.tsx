"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import { FilterPanel } from "./FilterPanel";
import type { PolyHavenCategory } from "@/lib/polyhaven/client";

interface MobileFilterDrawerProps {
  categories: PolyHavenCategory[];
}

export function MobileFilterDrawer({ categories }: MobileFilterDrawerProps) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();

  const activeCount = useMemo(
    () =>
      ["categories", "sources", "licenses", "formats"].reduce((sum, key) => {
        const values = searchParams.get(key)?.split(",").filter(Boolean) || [];
        return sum + values.length;
      }, 0),
    [searchParams]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden flex items-center gap-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 transition"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded bg-[#5E6AD2] text-white text-[10px] font-semibold">
            {activeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="lg:hidden fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-[var(--gs-bg-base)] border-l border-white/10 overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
            >
              <div className="sticky top-0 bg-[var(--gs-bg-base)]/95 backdrop-blur border-b border-white/10 p-4 flex items-center justify-between z-10">
                <h2 className="font-display font-semibold text-white">
                  Filters
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/5 transition"
                  aria-label="Close filters"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4">
                <FilterPanel categories={categories} embedded />
              </div>
              <div className="sticky bottom-0 border-t border-white/10 bg-[var(--gs-bg-base)]/95 backdrop-blur p-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="gs-btn gs-btn-primary gs-btn-full"
                >
                  Show results
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
