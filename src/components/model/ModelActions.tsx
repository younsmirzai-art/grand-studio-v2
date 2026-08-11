"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart, Share2, Check, Loader2 } from "lucide-react";

interface ModelActionsProps {
  name: string;
  modelId: string;
  modelThumbnail?: string;
}

export function ModelActions({
  name,
  modelId,
  modelThumbnail,
}: ModelActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/favorites", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { favorites: [] }))
      .then((data: { favorites?: Array<{ model_id: string }> }) => {
        if (cancelled) return;
        setIsFavorited(
          Boolean(data.favorites?.some((f) => f.model_id === modelId))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  const toggleFavorite = async () => {
    setFavLoading(true);
    try {
      if (isFavorited) {
        const res = await fetch(
          `/api/favorites?modelId=${encodeURIComponent(modelId)}`,
          { method: "DELETE", credentials: "include" }
        );
        if (res.status === 401) {
          router.push(
            `/auth/login?redirect=${encodeURIComponent(pathname)}`
          );
          return;
        }
        if (res.ok) setIsFavorited(false);
      } else {
        const res = await fetch("/api/favorites", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelId,
            modelName: name,
            modelThumbnail,
          }),
        });
        if (res.status === 401) {
          router.push(
            `/auth/login?redirect=${encodeURIComponent(pathname)}`
          );
          return;
        }
        if (res.ok) setIsFavorited(true);
      }
    } finally {
      setFavLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        type="button"
        onClick={toggleFavorite}
        disabled={favLoading}
        className="p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition disabled:opacity-50"
        aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
        title={isFavorited ? "Remove favorite" : "Add to favorites"}
      >
        {favLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-white/70" />
        ) : (
          <Heart
            className={`w-4 h-4 ${
              isFavorited ? "fill-pink-500 text-pink-500" : "text-white/70"
            }`}
          />
        )}
      </button>
      <button
        type="button"
        onClick={handleShare}
        className="p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
        aria-label="Share"
        title={copied ? "Link copied" : "Share"}
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Share2 className="w-4 h-4 text-white/70" />
        )}
      </button>
    </div>
  );
}
