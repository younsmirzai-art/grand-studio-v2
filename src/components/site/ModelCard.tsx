"use client";

import Link from "next/link";
import Image from "next/image";
import { Download } from "lucide-react";
import type { Model } from "@/lib/polyhaven/client";

interface ModelCardProps {
  model: Model;
  index?: number;
}

export function ModelCard({ model }: ModelCardProps) {
  return (
    <Link
      href={`/model/${model.id}`}
      className="group block gs-feature-card p-0 overflow-hidden hover:border-white/20 transition-colors"
    >
      <div className="relative aspect-square overflow-hidden bg-black/40">
        <Image
          src={model.thumbnail}
          alt={model.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 50vw, 25vw"
          unoptimized
        />

        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          {model.isFree && (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/20 text-green-300 border border-green-500/30 uppercase">
              Free
            </span>
          )}
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 backdrop-blur text-white/70">
            {model.source}
          </span>
        </div>
      </div>

      <div className="p-3">
        <h3 className="font-medium text-white truncate mb-1 text-sm">
          {model.name}
        </h3>
        <div className="flex items-center justify-between text-xs text-white/50">
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
