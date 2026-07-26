"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import type { Model } from "@/lib/polyhaven/client";

interface ModelCardProps {
  model: Model;
  index?: number;
}

export function ModelCard({ model, index = 0 }: ModelCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: (index % 8) * 0.05 }}
      className="gs-card group cursor-pointer"
    >
      <Link href={`/model/${model.id}`}>
        <div className="relative aspect-square overflow-hidden bg-black/40">
          <Image
            src={model.thumbnail}
            alt={model.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 50vw, 25vw"
            unoptimized
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
            {model.isFree && (
              <span className="px-2 py-1 rounded text-[10px] font-semibold bg-green-500/20 text-green-300 border border-green-500/30 uppercase">
                Free
              </span>
            )}
            <span className="px-2 py-1 rounded text-[10px] font-medium gs-glass text-white/70">
              {model.source}
            </span>
          </div>
        </div>

        <div className="p-4">
          <h3 className="font-medium text-white truncate mb-1.5 text-sm">
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
    </motion.div>
  );
}
