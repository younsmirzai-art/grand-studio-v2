"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

export function SearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function pushQuery(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextValue.trim()) {
      params.set("q", nextValue.trim());
    } else {
      params.delete("q");
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleChange(newValue: string) {
    setValue(newValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushQuery(newValue), 300);
  }

  function clear() {
    setValue("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pushQuery("");
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search 10,000+ models, textures, HDRIs..."
        className="w-full pl-10 pr-16 py-2.5 bg-slate-900/60 border border-white/10 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#5E6AD2]/50 focus:bg-slate-900/80 transition-all duration-200 ease-in-out text-sm backdrop-blur-md"
        aria-label="Search models"
      />
      {value ? (
        <button
          type="button"
          onClick={clear}
          className="absolute right-12 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 transition-all duration-200 ease-in-out"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5 text-slate-400" />
        </button>
      ) : null}
      <kbd className="hidden sm:flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center gap-0.5 text-[10px] text-slate-500 border border-white/10 rounded-md px-1.5 py-0.5 bg-white/5">
        ⌘K
      </kbd>
    </div>
  );
}
