"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

const APP_SHELL_PREFIXES = [
  "/dashboard",
  "/browse",
  "/library",
  "/generate",
  "/settings",
];

function isAppShellRoute(pathname: string): boolean {
  return APP_SHELL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAuthRoute(pathname: string): boolean {
  return pathname === "/auth" || pathname.startsWith("/auth/");
}

function isCinematicLanding(pathname: string): boolean {
  return pathname === "/";
}

/**
 * Marketing pages get the public Header + Footer.
 * Authenticated app pages use their own sidebar layout instead.
 * The cinematic home landing owns its own chrome.
 */
export function ConditionalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const useAppShell = isAppShellRoute(pathname);
  const hideMarketingChrome =
    useAppShell || isAuthRoute(pathname) || isCinematicLanding(pathname);

  if (hideMarketingChrome) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}
