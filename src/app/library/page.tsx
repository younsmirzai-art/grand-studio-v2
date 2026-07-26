import Link from "next/link";

export const metadata = {
  title: "Your Library",
  description: "Your downloaded and favorited 3D models.",
};

export default function LibraryPage() {
  return (
    <div className="min-h-screen pt-32 pb-24 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <h1 className="text-4xl font-display font-bold mb-4 gs-text-gradient">
          Your Library
        </h1>
        <p className="text-white/60 mb-8">
          Downloads and favorites coming in Phase 6.
        </p>
        <Link
          href="/browse"
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-medium inline-block"
        >
          Start Browsing
        </Link>
      </div>
    </div>
  );
}
