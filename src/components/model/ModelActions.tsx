"use client";

import { useState } from "react";
import { Heart, Share2, Check } from "lucide-react";

interface ModelActionsProps {
  name: string;
}

export function ModelActions({ name }: ModelActionsProps) {
  const [copied, setCopied] = useState(false);

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
        className="p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
        aria-label="Add to favorites"
        title="Add to favorites (coming soon)"
      >
        <Heart className="w-4 h-4 text-white/70" />
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
