"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseAuthHash } from "@/lib/supabase/auth-hash";

const SKIP_PATHS = ["/auth/callback", "/auth/reset-password"];

/**
 * If Supabase dumps hash tokens on the Site URL (redirect allowlist miss),
 * consume them here. Recovery tokens go to the reset page; everything else
 * becomes a dashboard session.
 */
export function AuthHashCatcher() {
  useEffect(() => {
    const tokens = parseAuthHash(window.location.hash);
    if (!tokens) return;

    const pathname = window.location.pathname.replace(/\/$/, "") || "/";
    if (SKIP_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
      return;
    }

    void (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (error) {
        const fallback =
          tokens.type === "recovery"
            ? `/auth/forgot-password?error=${encodeURIComponent("Reset link expired")}`
            : `/auth/login?error=${encodeURIComponent(error.message)}`;
        window.location.replace(fallback);
        return;
      }
      window.location.replace(
        tokens.type === "recovery" ? "/auth/reset-password" : "/dashboard"
      );
    })();
  }, []);

  return null;
}
