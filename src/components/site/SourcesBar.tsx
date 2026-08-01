export function SourcesBar() {
  const sources = [
    "Poly Haven",
    "Sketchfab",
    "Meshy",
    "CGTrader",
    "Free3D",
    "BlendSwap",
    "TurboSquid",
  ];

  return (
    <section className="border-y border-white/5 bg-black/20 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-xs uppercase tracking-widest text-white/40 mb-8 font-medium">
          Powered by the world&apos;s leading 3D sources
        </p>
        <div className="gs-trust-row gap-x-8 gap-y-4">
          {sources.map((source) => (
            <span
              key={source}
              className="text-white/40 hover:text-white/60 transition-colors font-display font-medium text-lg cursor-default"
            >
              {source}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
