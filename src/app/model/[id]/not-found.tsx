import Link from "next/link";
import { Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
          <Search className="w-7 h-7 text-white/30" />
        </div>

        <h1 className="text-3xl font-display font-bold mb-3">Model not found</h1>
        <p className="text-white/60 mb-8">
          The model you&apos;re looking for doesn&apos;t exist or may have been
          removed.
        </p>

        <Link
          href="/browse"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black font-semibold hover:bg-white/90 transition"
        >
          Browse all models
        </Link>
      </div>
    </div>
  );
}
