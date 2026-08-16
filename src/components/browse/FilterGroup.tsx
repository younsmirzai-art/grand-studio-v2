"use client";

import { useState } from "react";

export interface FilterOption {
  slug: string;
  name: string;
  count?: number | null;
  disabled?: boolean;
}

interface FilterGroupProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  maxVisible?: number;
}

export function FilterGroup({
  label,
  options,
  selected,
  onToggle,
  maxVisible = 6,
}: FilterGroupProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleOptions = showAll ? options : options.slice(0, maxVisible);
  const hasMore = options.length > maxVisible;

  return (
    <div className="gs-filter-group">
      <span className="gs-filter-label">{label}</span>
      <div className="space-y-2">
        {visibleOptions.map((option) => (
          <label
            key={option.slug}
            className={`flex items-center gap-2.5 group ${
              option.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <input
              type="checkbox"
              className="gs-filter-checkbox"
              checked={selected.includes(option.slug)}
              onChange={() => {
                if (!option.disabled) onToggle(option.slug);
              }}
              disabled={option.disabled}
            />
            <span className="text-sm text-white/70 group-hover:text-white transition flex-1 truncate">
              {option.name}
            </span>
            {option.count !== null && option.count !== undefined && (
              <span className="text-xs text-white/40 tabular-nums">
                {option.count.toLocaleString()}
              </span>
            )}
            {option.disabled && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-white/40 font-medium">
                SOON
              </span>
            )}
          </label>
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-xs text-slate-400 hover:text-slate-100 transition"
        >
          {showAll ? "Show less" : `Show all (${options.length})`}
        </button>
      )}
    </div>
  );
}
