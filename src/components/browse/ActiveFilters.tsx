"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";

interface ActiveFiltersProps {
  categoryLabels?: Record<string, string>;
}

const SOURCE_LABELS: Record<string, string> = {
  polyhaven: "Poly Haven",
  sketchfab: "Sketchfab",
  ambientcg: "ambientCG",
  meshy: "Meshy",
};

const LICENSE_LABELS: Record<string, string> = {
  cc0: "CC0",
  "cc-by": "CC-BY",
  "royalty-free": "Royalty-free",
};

const TYPE_LABELS: Record<string, string> = {
  models: "Models",
  textures: "Textures",
  hdris: "HDRIs",
};

export function ActiveFilters({ categoryLabels = {} }: ActiveFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters: Array<{
    key: string;
    value: string;
    label: string;
    groupLabel: string;
  }> = [];

  const groups: Array<{
    key: string;
    groupLabel: string;
    labelFor: (value: string) => string;
  }> = [
    {
      key: "categories",
      groupLabel: "Category",
      labelFor: (value) =>
        categoryLabels[value] ||
        value.charAt(0).toUpperCase() + value.slice(1),
    },
    {
      key: "sources",
      groupLabel: "Source",
      labelFor: (value) => SOURCE_LABELS[value] || value,
    },
    {
      key: "licenses",
      groupLabel: "License",
      labelFor: (value) => LICENSE_LABELS[value] || value.toUpperCase(),
    },
    {
      key: "formats",
      groupLabel: "Format",
      labelFor: (value) => value.toUpperCase(),
    },
  ];

  for (const group of groups) {
    const values = searchParams.get(group.key)?.split(",").filter(Boolean) || [];
    for (const value of values) {
      filters.push({
        key: group.key,
        value,
        label: group.labelFor(value),
        groupLabel: group.groupLabel,
      });
    }
  }

  const type = searchParams.get("type");
  if (type && type !== "all") {
    filters.unshift({
      key: "type",
      value: type,
      label: TYPE_LABELS[type] || type,
      groupLabel: "Type",
    });
  }

  if (filters.length === 0) return null;

  function removeFilter(key: string, value: string) {
    const current = searchParams.get(key)?.split(",").filter(Boolean) || [];
    const next = current.filter((v) => v !== value);
    const params = new URLSearchParams(searchParams.toString());
    if (next.length === 0) {
      params.delete(key);
    } else {
      params.set(key, next.join(","));
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {filters.map((filter) => (
        <span key={`${filter.key}-${filter.value}`} className="gs-chip">
          <span className="text-white/50">{filter.groupLabel}:</span>
          <span>{filter.label}</span>
          <button
            type="button"
            onClick={() => removeFilter(filter.key, filter.value)}
            className="gs-chip-remove"
            aria-label={`Remove ${filter.label}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
