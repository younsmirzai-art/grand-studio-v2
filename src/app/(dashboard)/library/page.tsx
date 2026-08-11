import { Suspense } from "react";
import type { Metadata } from "next";
import { LibraryClient } from "./LibraryClient";

export const metadata: Metadata = {
  title: "My Library",
  description: "Your downloads and favorites.",
};

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 lg:p-8 text-sm text-white/50">Loading library…</div>
      }
    >
      <LibraryClient />
    </Suspense>
  );
}
