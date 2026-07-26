"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { getClient } from "@/lib/supabase/client";

/**
 * "unknown" is held until the session resolves so signed-in visitors never see
 * a flash of the signed-out actions. Access itself is enforced by middleware.
 */
type AuthState = "unknown" | "signed-in" | "signed-out";

export function Header() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authState, setAuthState] = useState<AuthState>("unknown");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const supabase = getClient();
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setAuthState(data.session ? "signed-in" : "signed-out");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState(session ? "signed-in" : "signed-out");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    setMobileOpen(false);
    await getClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "gs-glass-strong border-b border-white/10 py-3"
            : "bg-transparent py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg gs-glow-purple-sm bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-bold text-sm shadow-lg group-hover:scale-105 transition-transform">
              GS
            </div>
            <span className="font-display font-semibold text-lg tracking-tight text-white">
              Grand Studio
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/browse"
              className="text-sm text-white/70 hover:text-white transition font-medium"
            >
              Browse
            </Link>
            <Link
              href="/plugin"
              className="text-sm text-white/70 hover:text-white transition font-medium flex items-center gap-1.5"
            >
              Plugin
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">
                NEW
              </span>
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-white/70 hover:text-white transition font-medium"
            >
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {/* Placeholder holds the slot's width so resolving auth doesn't shift the header. */}
            {authState === "unknown" && <div className="w-[124px] h-9" aria-hidden />}

            {authState === "signed-out" && (
              <>
                <Link
                  href="/auth/login"
                  className="hidden sm:block text-sm text-white/70 hover:text-white transition font-medium"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                >
                  Get Started
                </Link>
              </>
            )}

            {authState === "signed-in" && (
              <>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="hidden sm:block text-sm text-white/70 hover:text-white transition font-medium"
                >
                  Sign out
                </button>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                >
                  Dashboard
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-white/70 hover:text-white transition"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 pt-20 gs-glass-strong md:hidden">
          <div className="p-6 space-y-4">
            <Link
              href="/browse"
              className="block text-lg text-white/80 hover:text-white transition py-2"
              onClick={() => setMobileOpen(false)}
            >
              Browse
            </Link>
            <Link
              href="/plugin"
              className="block text-lg text-white/80 hover:text-white transition py-2"
              onClick={() => setMobileOpen(false)}
            >
              Plugin
            </Link>
            <Link
              href="/pricing"
              className="block text-lg text-white/80 hover:text-white transition py-2"
              onClick={() => setMobileOpen(false)}
            >
              Pricing
            </Link>
            {authState === "signed-in" ? (
              <>
                <Link
                  href="/dashboard"
                  className="block text-lg text-white/80 hover:text-white transition py-2 border-t border-white/10 mt-4 pt-4"
                  onClick={() => setMobileOpen(false)}
                >
                  Dashboard
                </Link>
                <Link
                  href="/library"
                  className="block text-lg text-white/80 hover:text-white transition py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  Library
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="block text-lg text-white/80 hover:text-white transition py-2"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="block text-lg text-white/80 hover:text-white transition py-2 border-t border-white/10 mt-4 pt-4"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
