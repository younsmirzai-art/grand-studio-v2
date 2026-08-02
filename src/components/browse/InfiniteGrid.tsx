"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ModelCard } from "@/components/site/ModelCard";
import type { Model } from "@/lib/polyhaven/client";

const PAGE_SIZE = 24;

export function InfiniteGrid() {
  const searchParams = useSearchParams();
  const [models, setModels] = useState<Model[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const modelsLengthRef = useRef(0);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const queryKey = searchParams.toString();

  useEffect(() => {
    modelsLengthRef.current = models.length;
  }, [models.length]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const fetchModels = useCallback(
    async (offset: number, replace: boolean) => {
      if (loadingRef.current && !replace) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(offset));

        const q = searchParams.get("q");
        const categories = searchParams.get("categories");
        const sources = searchParams.get("sources");
        const licenses = searchParams.get("licenses");
        const sort = searchParams.get("sort") || "popular";

        if (q) params.set("q", q);
        if (categories) params.set("categories", categories);
        if (sources) params.set("sources", sources);
        if (licenses) params.set("licenses", licenses);
        params.set("sort", sort);

        const res = await fetch(`/api/browse?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch");

        const data = (await res.json()) as {
          models: Model[];
          total: number;
        };

        setModels((prev) => (replace ? data.models : [...prev, ...data.models]));
        setTotal(data.total);
        const nextHasMore = offset + PAGE_SIZE < data.total;
        setHasMore(nextHasMore);
        hasMoreRef.current = nextHasMore;
      } catch (err) {
        console.error("Browse fetch error:", err);
        setError("Could not load models. Please try again.");
        if (replace) {
          setModels([]);
          setTotal(0);
          setHasMore(false);
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [searchParams]
  );

  useEffect(() => {
    setInitialLoading(true);
    setModels([]);
    setHasMore(true);
    hasMoreRef.current = true;
    modelsLengthRef.current = 0;
    void fetchModels(0, true);
  }, [queryKey, fetchModels]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          !loadingRef.current &&
          hasMoreRef.current
        ) {
          void fetchModels(modelsLengthRef.current, false);
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchModels, queryKey]);

  if (initialLoading) {
    return <ModelGridSkeleton />;
  }

  if (error && models.length === 0) {
    return (
      <div className="py-24 text-center gs-feature-card p-12 max-w-md mx-auto">
        <p className="text-white/70 mb-2 font-medium">{error}</p>
        <button
          type="button"
          onClick={() => {
            setInitialLoading(true);
            void fetchModels(0, true);
          }}
          className="text-sm text-cyan-400 hover:text-cyan-300 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="py-24 text-center gs-feature-card p-12 max-w-md mx-auto">
        <p className="text-white/60 mb-2 font-medium">No models found</p>
        <p className="text-white/40 text-sm">
          Try different filters or search terms
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 text-sm text-white/50">
        Showing {models.length.toLocaleString()} of {total.toLocaleString()}{" "}
        models
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {models.map((model, i) => (
          <ModelCard key={`${model.id}-${i}`} model={model} index={i} />
        ))}
      </div>

      <div
        ref={sentinelRef}
        className="py-12 flex items-center justify-center min-h-12"
      >
        {loading && (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading more...</span>
          </div>
        )}
        {!hasMore && !loading && (
          <div className="text-sm text-white/40">
            You&apos;ve reached the end · {models.length.toLocaleString()} models
          </div>
        )}
      </div>
    </>
  );
}

function ModelGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="gs-feature-card p-0 overflow-hidden">
          <div className="aspect-square bg-white/5 animate-pulse" />
          <div className="p-3">
            <div className="h-4 bg-white/5 rounded animate-pulse mb-2" />
            <div className="h-3 bg-white/5 rounded animate-pulse w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
