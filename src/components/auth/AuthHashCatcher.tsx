"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseAuthHash } from "@/lib/supabase/auth-hash";

/**
 * Safety net: if Supabase rejects /auth/callback (not in the redirect
 * allowlist), the verify step dumps #access_token on the Site URL instead.
 * A Route Handler never sees that fragment, so we consume it here on any page.
 */
export function AuthHashCatcher() {
  useEffect(() => {
    const tokens = parseAuthHash(window.location.hash);
    if (!tokens) return;

    const pathname = window.location.pathname;
    if (pathname === "/auth/callback" || pathname.startsWith("/auth/callback/")) {
      return;
    }

    void (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.setSession(tokens);
      if (error) {
        window.location.replace(
          `/auth/login?error=${encodeURIComponent(error.message)}`
        );
        return;
      }
      window.location.replace("/dashboard");
    })();
  }, []);

  return null;
}
