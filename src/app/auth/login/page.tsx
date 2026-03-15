"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail, Lock, Gamepad2 } from "lucide-react";
import { createAuthClient } from "@/lib/supabase/auth-client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createAuthClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center px-4 relative">
      <div className="absolute inset-0 epic-dot-grid pointer-events-none opacity-40" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#2196F3]/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="w-3 h-3 rounded-sm bg-[#2196F3]" />
            <span className="text-sm font-bold tracking-[0.2em] uppercase text-white">
              Grand Studio
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Welcome Back
          </h1>
          <p className="text-[#606068] text-sm mt-1">
            Sign in to your workspace
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#111114]/80 backdrop-blur-xl p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#A0A0A8] mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606068]" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#1A1A1F] border border-[#2A2A30] text-white placeholder:text-[#606068] text-sm outline-none focus:border-[#2196F3]/40 focus:ring-2 focus:ring-[#2196F3]/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#A0A0A8] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606068]" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#1A1A1F] border border-[#2A2A30] text-white placeholder:text-[#606068] text-sm outline-none focus:border-[#2196F3]/40 focus:ring-2 focus:ring-[#2196F3]/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white font-semibold text-sm transition-all disabled:opacity-50 epic-cta-glow flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "SIGN IN"}
            </button>

            <div className="relative my-6">
              <span className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/5" />
              </span>
              <span className="relative flex justify-center text-xs text-[#606068]">or</span>
            </div>

            <a
              href="/api/auth/epic"
              className="w-full py-3 rounded-lg bg-[#1A1A1F] border border-white/10 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition"
            >
              <Gamepad2 className="w-4 h-4" />
              Sign in with Epic Games
            </a>
          </form>

          <p className="text-center text-[#606068] text-sm mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-[#2196F3] hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
