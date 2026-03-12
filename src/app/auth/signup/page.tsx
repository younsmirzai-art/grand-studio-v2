"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail, Lock, CheckCircle } from "lucide-react";
import { createAuthClient } from "@/lib/supabase/auth-client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const supabase = createAuthClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
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
            Create Account
          </h1>
          <p className="text-[#606068] text-sm mt-1">
            Start building UE5 scenes with AI
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#111114]/80 backdrop-blur-xl p-8">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-[#4CAF50] mx-auto mb-4" />
              <h2 className="text-lg font-bold text-white mb-2">Check your email</h2>
              <p className="text-[#A0A0A8] text-sm mb-6">
                We sent a confirmation link to{" "}
                <span className="text-white font-medium">{email}</span>.
                Click it to activate your account.
              </p>
              <Link href="/auth/login" className="text-[#2196F3] hover:underline text-sm font-medium">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSignup} className="space-y-5">
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
                      minLength={6}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#1A1A1F] border border-[#2A2A30] text-white placeholder:text-[#606068] text-sm outline-none focus:border-[#2196F3]/40 focus:ring-2 focus:ring-[#2196F3]/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#A0A0A8] mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606068]" />
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#1A1A1F] border border-[#2A2A30] text-white placeholder:text-[#606068] text-sm outline-none focus:border-[#2196F3]/40 focus:ring-2 focus:ring-[#2196F3]/20 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white font-semibold text-sm transition-all disabled:opacity-50 epic-cta-glow flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "CREATE ACCOUNT"}
                </button>
              </form>

              <p className="text-center text-[#606068] text-sm mt-6">
                Already have an account?{" "}
                <Link href="/auth/login" className="text-[#2196F3] hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
