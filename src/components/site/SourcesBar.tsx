const sources = [
  { name: "Poly Haven", note: "CC0 models" },
  { name: "Sketchfab", note: "Downloadable" },
  { name: "Meshy", note: "AI generation" },
  { name: "CGTrader", note: "Marketplace" },
  { name: "Free3D", note: "Free assets" },
  { name: "BlendSwap", note: "Blender" },
  { name: "TurboSquid", note: "Pro catalog" },
];

export function SourcesBar() {
  return (
    <section className="border-y border-white/5 bg-black/20 py-14">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-xs uppercase tracking-widest text-white/40 mb-8 font-medium">
          Powered by the world&apos;s leading 3D sources
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {sources.map((source) => (
            <div
              key={source.name}
              className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-4 text-center hover:border-white/15 hover:bg-white/[0.05] transition-colors"
            >
              <div className="font-display font-semibold text-sm text-white/80 mb-1">
                {source.name}
              </div>
              <div className="text-[10px] text-white/35">{source.note}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
