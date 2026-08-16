"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { decodeAuthErrorParam } from "@/lib/supabase/auth-hash";
import { AuthShell } from "@/components/auth/AuthShell";
import { isValidEmail } from "@/components/auth/PasswordInput";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(
    urlError ? decodeAuthErrorParam(urlError) : ""
  );
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = isValidEmail(email) && !loading;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }
      );
      if (resetError) {
        setError(resetError.message);
        return;
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
            Remember your password?{" "}
            <Link
              href="/auth/login"
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
            Reset instructions sent to{" "}
            <span className="text-white font-medium">{email.trim()}</span>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send a reset link"
      error={error}
      footer={
        <>
          Remember your password?{" "}
          <Link
            href="/auth/login"
            className="text-cyan-400 hover:text-cyan-300 font-medium"
          >
            Sign in
          </Link>
        </>
      }
    >
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
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Send reset link"
          )}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
