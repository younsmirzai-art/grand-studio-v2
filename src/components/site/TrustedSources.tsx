export function TrustedSources() {
  const sources = [
    "Poly Haven",
    "Sketchfab",
    "Meshy",
    "CGTrader",
    "Free3D",
    "BlendSwap",
    "TurboSquid",
    "Mixamo",
  ];

  return (
    <section className="py-16 border-y border-white/5 overflow-hidden bg-black/20">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-xs uppercase tracking-widest text-white/40 mb-10 font-medium">
          Trusted sources — all in one place
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {sources.map((source) => (
            <span
              key={source}
              className="text-white/50 font-display font-medium text-lg hover:text-white transition-colors cursor-default"
            >
              {source}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
