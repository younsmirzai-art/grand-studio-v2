import { Sparkles, Wand2 } from "lucide-react";

export const metadata = {
  title: "AI Generator",
  description: "Create 3D models from text prompts.",
};

export default function GeneratePage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-purple-300" />
          <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
            AI Generator · Coming Soon
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-3">
          Create with AI
        </h1>
        <p className="text-white/60 max-w-xl mx-auto">
          Describe any 3D model in plain English and watch it come to life.
          Full functionality coming in Phase 4.
        </p>
      </div>

      <div className="gs-card p-8">
        <div className="flex items-center gap-2 mb-4 text-sm text-white/50">
          <Wand2 className="w-4 h-4" />
          <span>Preview interface</span>
        </div>

        <textarea
          disabled
          placeholder="A cyberpunk motorcycle with neon accents..."
          className="w-full h-32 p-4 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 resize-none focus:outline-none"
        />

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-white/40">
            AI Generator will be available soon
          </div>
          <button
            type="button"
            disabled
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-sm font-semibold opacity-50 cursor-not-allowed"
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
