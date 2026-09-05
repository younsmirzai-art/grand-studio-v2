"use client";

import { usePathname } from "next/navigation";

/** Soft brand glow for marketing pages — disabled on the cinematic home. */
export function AmbientBackground() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <div className="pointer-events-none fixed inset-0 gs-ambient" aria-hidden />
  );
}
