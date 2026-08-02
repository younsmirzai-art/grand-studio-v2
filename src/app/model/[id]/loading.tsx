export default function Loading() {
  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="h-4 w-32 bg-white/5 rounded animate-pulse mb-4" />
        <div className="h-4 w-24 bg-white/5 rounded animate-pulse mb-2" />
        <div className="h-10 w-64 bg-white/5 rounded animate-pulse mb-3" />
        <div className="flex gap-2 mb-6">
          <div className="h-6 w-16 bg-white/5 rounded animate-pulse" />
          <div className="h-6 w-20 bg-white/5 rounded animate-pulse" />
          <div className="h-6 w-14 bg-white/5 rounded animate-pulse" />
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          <div className="aspect-square bg-white/5 rounded-2xl animate-pulse" />
          <div className="space-y-4">
            <div className="gs-card p-5 h-48 animate-pulse bg-white/[0.03]" />
            <div className="gs-card p-5 h-64 animate-pulse bg-white/[0.03]" />
          </div>
        </div>
      </div>
    </div>
  );
}
