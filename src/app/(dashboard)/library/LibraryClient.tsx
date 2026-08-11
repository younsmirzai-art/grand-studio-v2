"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { FolderOpen, Heart, Loader2 } from "lucide-react";

interface LibraryItem {
  model_id: string;
  model_name: string;
  model_thumbnail?: string | null;
  format?: string;
  downloaded_at?: string;
  added_at?: string;
}

export function LibraryClient() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "favorites" ? "favorites" : "downloads";
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const endpoint =
      tab === "favorites" ? "/api/favorites" : "/api/downloads";

    fetch(endpoint, { credentials: "include" })
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = `/auth/login?redirect=${encodeURIComponent(
            tab === "favorites" ? "/library?tab=favorites" : "/library"
          )}`;
          return null;
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error || "Failed to load");
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        const list =
          tab === "favorites"
            ? (data.favorites as LibraryItem[]) || []
            : (data.downloads as LibraryItem[]) || [];
        setItems(list);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab]);

  const title = tab === "favorites" ? "Favorites" : "Downloads";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight mb-1">
          My Library
        </h1>
        <p className="text-sm text-white/50">
          All your downloads and favorites in one place.
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-white/5 mb-6">
        <Link
          href="/library"
          className={`px-4 py-2 text-sm font-medium transition ${
            tab === "downloads"
              ? "text-white border-b-2 border-cyan-400"
              : "text-white/50 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Downloads
          </div>
        </Link>
        <Link
          href="/library?tab=favorites"
          className={`px-4 py-2 text-sm font-medium transition ${
            tab === "favorites"
              ? "text-white border-b-2 border-cyan-400"
              : "text-white/50 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Favorites
          </div>
        </Link>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center text-white/50 text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading {title.toLowerCase()}…
        </div>
      ) : error ? (
        <div className="py-16 text-center text-red-400 text-sm">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            {tab === "favorites" ? (
              <Heart className="w-7 h-7 text-white/30" />
            ) : (
              <FolderOpen className="w-7 h-7 text-white/30" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            No {title.toLowerCase()} yet
          </h3>
          <p className="text-sm text-white/50 mb-6 max-w-md mx-auto">
            {tab === "favorites"
              ? "Save models you love with the heart button on any model page."
              : "Download models from the marketplace and they’ll show up here."}
          </p>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-sm font-semibold hover:opacity-90 transition"
          >
            Browse Models
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <Link
              key={`${item.model_id}-${item.format || item.added_at}`}
              href={`/model/${item.model_id}`}
              className="gs-card overflow-hidden group hover:border-white/15 transition"
            >
              <div className="relative aspect-square bg-black/40">
                {item.model_thumbnail ? (
                  <Image
                    src={item.model_thumbnail}
                    alt={item.model_name}
                    fill
                    className="object-cover group-hover:scale-[1.02] transition-transform"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs">
                    No preview
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="text-sm font-medium text-white truncate">
                  {item.model_name}
                </div>
                <div className="text-[11px] text-white/40 mt-1 uppercase">
                  {item.format || "Saved"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
