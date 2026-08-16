"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Download, Heart } from "lucide-react";
import type { Model } from "@/lib/polyhaven/client";

interface ModelCardProps {
  model: Model;
  index?: number;
}

export function ModelCard({ model }: ModelCardProps) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleFavorite(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (favorited) {
        const res = await fetch(
          `/api/favorites?modelId=${encodeURIComponent(model.id)}`,
          { method: "DELETE", credentials: "include" }
        );
        if (res.status === 401) {
          router.push("/auth/login?redirect=/browse");
          return;
        }
        if (res.ok) setFavorited(false);
      } else {
        const res = await fetch("/api/favorites", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelId: model.id,
            modelName: model.name,
            modelThumbnail: model.thumbnail,
          }),
        });
        if (res.status === 401) {
          router.push("/auth/login?redirect=/browse");
          return;
        }
        if (res.ok) setFavorited(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Link
      href={`/model/${model.id}`}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md transition-all duration-200 ease-in-out hover:border-white/20"
    >
      <div className="relative aspect-square overflow-hidden bg-black/40">
        <Image
          src={model.thumbnail}
          alt={model.name}
          fill
          className="object-cover transition-transform duration-500 ease-in-out group-hover:scale-110"
          sizes="(max-width: 768px) 50vw, 25vw"
          unoptimized
        />

        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          {model.isFree && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wide">
              Free
            </span>
          )}
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-950/70 backdrop-blur text-slate-200 border border-white/10">
            {model.source}
          </span>
          {model.kind && model.kind !== "model" ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#5E6AD2]/20 text-[#A5B4FC] border border-[#5E6AD2]/30 uppercase tracking-wide">
              {model.kind}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={(event) => void toggleFavorite(event)}
          aria-label={favorited ? "Remove favorite" : "Add favorite"}
          className="absolute top-3 right-3 w-8 h-8 rounded-full border border-white/10 bg-slate-950/70 backdrop-blur flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 ease-in-out hover:border-pink-400/40"
        >
          <Heart
            className={`w-3.5 h-3.5 ${
              favorited ? "fill-pink-400 text-pink-400" : "text-slate-200"
            }`}
          />
        </button>
      </div>

      <div className="p-3">
        <h3 className="font-medium text-slate-100 truncate mb-1 text-sm">
          {model.name}
        </h3>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Download className="w-3 h-3" />
            {model.downloads.toLocaleString()}
          </span>
          {model.categories.length > 0 && (
            <span className="capitalize truncate ml-2">
              {model.categories[0]}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
