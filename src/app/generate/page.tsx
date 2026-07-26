import Link from "next/link";
import { Sparkles } from "lucide-react";

export const metadata = {
  title: "AI 3D Generator",
  description: "Generate 3D models from text prompts.",
};

export default function GeneratePage() {
  return (
    <div className="min-h-screen pt-32 pb-24 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mx-auto mb-6 gs-animate-pulse-glow">
          <Sparkles className="w-7 h-7 text-white" />
        </div>

        <h1 className="text-4xl font-display font-bold mb-4 gs-text-gradient">
          AI 3D Generator
        </h1>
        <p className="text-white/60 mb-8">
          Generate 3D models from text prompts. Coming in Phase 4.
        </p>
        <Link
          href="/browse"
          className="px-6 py-3 rounded-xl gs-glass text-white font-medium inline-block"
        >
          Browse Models Meanwhile
        </Link>
      </div>
    </div>
  );
}
