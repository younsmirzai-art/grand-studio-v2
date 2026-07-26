import Link from "next/link";
import { FolderOpen, Heart } from "lucide-react";

export const metadata = {
  title: "My Library",
  description: "Your downloads and favorites.",
};

interface LibraryPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const tab = params.tab === "favorites" ? "favorites" : "downloads";
  const title = tab === "favorites" ? "Favorites" : "Downloads";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight mb-1">
          My Library
        </h1>
        <p className="text-sm text-white/50">
          All your downloads and favorites in one place.
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-white/5 mb-6">
        <Link
          href="/library"
          className={`px-4 py-2 text-sm font-medium transition ${
            tab === "downloads"
              ? "text-white border-b-2 border-cyan-400"
              : "text-white/50 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Downloads
          </div>
        </Link>
        <Link
          href="/library?tab=favorites"
          className={`px-4 py-2 text-sm font-medium transition ${
            tab === "favorites"
              ? "text-white border-b-2 border-cyan-400"
              : "text-white/50 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Favorites
          </div>
        </Link>
      </div>

      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
          {tab === "favorites" ? (
            <Heart className="w-7 h-7 text-white/30" />
          ) : (
            <FolderOpen className="w-7 h-7 text-white/30" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          No {title.toLowerCase()} yet
        </h3>
        <p className="text-sm text-white/50 mb-6 max-w-md mx-auto">
          Start exploring our marketplace to discover amazing 3D models. Full
          library sync arrives in Phase 6.
        </p>
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-sm font-semibold hover:opacity-90 transition"
        >
          Browse Models
        </Link>
      </div>
    </div>
  );
}
