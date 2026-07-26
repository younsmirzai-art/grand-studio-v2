import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

export function QuickStartCard() {
  return (
    <div className="gs-card p-5 h-full relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-cyan-500/5 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
            New
          </span>
        </div>

        <h3 className="font-display font-semibold text-lg text-white mb-2">
          Try AI Generator
        </h3>
        <p className="text-sm text-white/60 mb-6 leading-relaxed">
          Create custom 3D models from text prompts. Just describe what you
          want.
        </p>

        <Link
          href="/generate"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/20 transition"
        >
          Start Creating
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
