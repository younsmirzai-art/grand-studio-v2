"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { parseAuthHash, safeNextPath } from "@/lib/supabase/auth-hash";

function otpType(value: string | null): EmailOtpType {
  switch (value) {
    case "email":
    case "magiclink":
    case "signup":
    case "invite":
    case "recovery":
    case "email_change":
      return value;
    default:
      return "magiclink";
  }
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Signing you in…");

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      const next = safeNextPath(url.searchParams.get("next"));
      const errorParam = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description");
      const hashTokens = parseAuthHash(url.hash);

      console.log("AUTH_CALLBACK_HIT", {
        hasCode: Boolean(code),
        codeLength: code?.length || 0,
        hasTokenHash: Boolean(tokenHash),
        hasHashTokens: Boolean(hashTokens),
        type,
        next,
        origin: url.origin,
      });

      if (errorParam) {
        const message = errorDescription || errorParam;
        router.replace(`/auth/login?error=${encodeURIComponent(message)}`);
        return;
      }

      const supabase = createClient();
      let exchangeError: string | null = null;

      // Confirmation and OAuth callbacks may include tokens in the URL hash.
      if (hashTokens) {
        setStatus("Saving your session…");
        const { data, error } = await supabase.auth.setSession(hashTokens);
        console.log("AUTH_CALLBACK_EXCHANGE", {
          method: "setSession",
          success: !error,
          errorMessage: error?.message,
          hasSession: Boolean(data.session),
        });
        if (!error && data.session) {
          window.location.replace(next);
          return;
        }
        exchangeError = error?.message ?? "Could not store session from confirmation link";
      } else if (tokenHash) {
        setStatus("Verifying your email…");
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType(type),
        });
        console.log("AUTH_CALLBACK_EXCHANGE", {
          method: "verifyOtp",
          success: !error,
          errorMessage: error?.message,
          hasSession: Boolean(data.session),
        });
        if (!error && data.session) {
          window.location.replace(next);
          return;
        }
        exchangeError = error?.message ?? "Email verification failed";
      } else if (code) {
        setStatus("Completing sign-in…");
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        console.log("AUTH_CALLBACK_EXCHANGE", {
          method: "exchangeCodeForSession",
          success: !error,
          errorMessage: error?.message,
          hasSession: Boolean(data.session),
        });
        if (!error && data.session) {
          window.location.replace(next);
          return;
        }
        exchangeError = error?.message ?? "Code exchange failed";
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log("AUTH_CALLBACK_SESSION", {
        hasSession: Boolean(session),
        exchangeError,
      });

      if (cancelled) return;

      if (session) {
        window.location.replace(next);
        return;
      }

      const message =
        exchangeError ||
        "Could not complete sign-in. Request a new confirmation email and try again.";
      router.replace(`/auth/login?error=${encodeURIComponent(message)}`);
    }

    completeAuth().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Sign-in failed";
      console.error("AUTH_CALLBACK_ERROR", message);
      if (!cancelled) {
        router.replace(`/auth/login?error=${encodeURIComponent(message)}`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="gs-card p-8 max-w-sm w-full text-center">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-4" />
        <p className="text-sm text-white/70">{status}</p>
      </div>
    </div>
  );
}
