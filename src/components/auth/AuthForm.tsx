"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  decodeAuthErrorParam,
  getEmailRedirectTo,
  safeNextPath,
} from "@/lib/supabase/auth-hash";
import { AuthShell } from "@/components/auth/AuthShell";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import {
  PasswordInput,
  isValidEmail,
} from "@/components/auth/PasswordInput";

const RESEND_STORAGE_KEY = "gs-confirm-resend-at";
const RESEND_COOLDOWN_MS = 60_000;

function readResendRemaining(): number {
  if (typeof window === "undefined") return 0;
  const raw = sessionStorage.getItem(RESEND_STORAGE_KEY);
  if (!raw) return 0;
  const remaining = Math.ceil(
    (Number(raw) + RESEND_COOLDOWN_MS - Date.now()) / 1000
  );
  return remaining > 0 ? remaining : 0;
}

function markResendSent() {
  sessionStorage.setItem(RESEND_STORAGE_KEY, String(Date.now()));
}

function isEmailNotConfirmed(message: string, code?: string): boolean {
  return (
    code === "email_not_confirmed" ||
    /email not confirmed/i.test(message)
  );
}

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  return (
    <Suspense>
      <AuthForm mode={mode} />
    </Suspense>
  );
}

function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const searchParams = useSearchParams();
  const redirectTo = safeNextPath(
    searchParams.get("redirect") || searchParams.get("redirectTo")
  );
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    urlError ? decodeAuthErrorParam(urlError) : ""
  );
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendRemaining, setResendRemaining] = useState(0);
  const [resendMessage, setResendMessage] = useState("");

  const isLogin = mode === "login";
  const emailOk = isValidEmail(email);
  const passwordOk = password.length >= 8;
  const canSubmit = emailOk && passwordOk && !loading;

  useEffect(() => {
    setResendRemaining(readResendRemaining());
    const timer = window.setInterval(() => {
      setResendRemaining(readResendRemaining());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const passwordError = useMemo(() => {
    if (!password || password.length >= 8) return "";
    return "Password must be at least 8 characters.";
  }, [password]);

  const resendConfirmation = async () => {
    if (!emailOk || resendRemaining > 0) return;
    setResendMessage("");
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: getEmailRedirectTo("/auth/callback"),
      },
    });
    if (resendError) {
      setResendMessage(resendError.message);
      return;
    }
    markResendSent();
    setResendRemaining(60);
    setResendMessage("Confirmation email sent.");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError("");
    setNeedsConfirm(false);
    setResendMessage("");
    setLoading(true);

    const supabase = createClient();
    const trimmedEmail = email.trim();

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (signInError) {
          if (isEmailNotConfirmed(signInError.message, signInError.code)) {
            setNeedsConfirm(true);
            setError("Please confirm your email first.");
            return;
          }
          setError("Invalid email or password.");
          return;
        }
        window.location.replace(redirectTo);
        return;
      }

      const emailRedirectTo = getEmailRedirectTo("/auth/callback");
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { emailRedirectTo },
      });
      console.log("SIGNUP_RESPONSE", {
        hasUser: Boolean(data?.user),
        hasSession: Boolean(data?.session),
        userId: data?.user?.id,
        userEmail: data?.user?.email,
        emailConfirmedAt: data?.user?.email_confirmed_at,
        identityCount: data?.user?.identities?.length ?? 0,
        error: signUpError?.message,
        emailRedirectTo,
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (!data.user) {
        setError("Could not create account. Please try again.");
        return;
      }

      const isRepeatedSignup = (data.user.identities?.length ?? 0) === 0;
      if (isRepeatedSignup) {
        const { error: resendError } = await supabase.auth.resend({
          type: "signup",
          email: trimmedEmail,
          options: { emailRedirectTo },
        });
        if (resendError) {
          setError(
            "An account with this email already exists. Sign in, or use Forgot password if you do not have a password yet."
          );
          return;
        }
        setSent(true);
        return;
      }

      if (data.session && data.user.email_confirmed_at) {
        window.location.replace(redirectTo);
        return;
      }
      if (data.session) {
        await supabase.auth.signOut();
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        footer={
          <>
            Already have an account?{" "}
            <Link
              href={`/auth/login?redirect=${encodeURIComponent(redirectTo)}`}
              className="text-cyan-400 hover:text-cyan-300 font-medium"
            >
              Sign in
            </Link>
          </>
        }
      >
        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-emerald-400" />
          </div>
          <p className="text-sm text-white/55 leading-relaxed">
            We sent a confirmation link to{" "}
            <span className="text-white font-medium">{email.trim()}</span>.
            Click it to activate your account and sign in.
          </p>
          <button
            type="button"
            disabled={resendRemaining > 0}
            onClick={() => void resendConfirmation()}
            className="mt-6 text-sm text-cyan-400 hover:text-cyan-300 transition disabled:text-white/35 disabled:cursor-not-allowed"
          >
            {resendRemaining > 0
              ? `Resend in ${resendRemaining}s`
              : "Didn't get it? Resend"}
          </button>
          {resendMessage ? (
            <p className="mt-2 text-xs text-white/50">{resendMessage}</p>
          ) : null}
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={isLogin ? "Welcome back" : "Create your account"}
      subtitle={
        isLogin
          ? "Sign in to continue to Grand Studio"
          : "Get started with Grand Studio"
      }
      error={error}
      errorTitle={urlError && !needsConfirm ? "Sign-in failed" : undefined}
      footer={
        isLogin ? (
          <>
            Don&apos;t have an account?{" "}
            <Link
              href={`/auth/signup?redirect=${encodeURIComponent(redirectTo)}`}
              className="text-cyan-400 hover:text-cyan-300 font-medium"
            >
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href={`/auth/login?redirect=${encodeURIComponent(redirectTo)}`}
              className="text-cyan-400 hover:text-cyan-300 font-medium"
            >
              Sign in
            </Link>
          </>
        )
      }
    >
      {needsConfirm ? (
        <p className="mb-5 -mt-2 text-sm text-white/60">
          <button
            type="button"
            disabled={resendRemaining > 0}
            onClick={() => void resendConfirmation()}
            className="text-cyan-400 hover:text-cyan-300 font-medium disabled:text-white/35"
          >
            {resendRemaining > 0
              ? `Resend confirmation in ${resendRemaining}s`
              : "Resend confirmation"}
          </button>
          {resendMessage ? (
            <span className="block mt-1 text-xs text-white/45">
              {resendMessage}
            </span>
          ) : null}
        </p>
      ) : null}

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-white/60 mb-1.5"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              required
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/35 text-sm outline-none focus:border-white/25 focus:bg-white/10 transition"
            />
          </div>
        </div>

        {isLogin ? (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-white/60"
              >
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Forgot?
              </Link>
            </div>
            <PasswordInput
              id="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
          </div>
        ) : (
          <PasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            error={passwordError}
            showStrength
          />
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isLogin ? (
            "Sign in"
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <OAuthButtons redirectTo={redirectTo} onError={setError} />
    </AuthShell>
  );
}
