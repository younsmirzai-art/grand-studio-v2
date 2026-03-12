"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, Loader2, Mail, Lock, CheckCircle } from "lucide-react";
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
    <div className="min-h-screen bg-boss-bg flex items-center justify-center px-4">
      <div className="absolute inset-0 hero-grid pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-gold/5 animate-glow-pulse pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-4 gold-glow">
            <Crown className="w-7 h-7 text-gold" />
          </div>
          <h1 className="text-2xl font-black text-text-primary tracking-tight">
            Grand <span className="text-gradient-gold">Studio</span>
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Create your account to get started
          </p>
        </div>

        <div className="rounded-2xl border border-boss-border bg-boss-card/80 p-8 card-glow">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-agent-green mx-auto mb-4" />
              <h2 className="text-lg font-bold text-text-primary mb-2">
                Check your email
              </h2>
              <p className="text-text-secondary text-sm mb-6">
                We sent a confirmation link to{" "}
                <span className="text-text-primary font-medium">{email}</span>.
                Click it to activate your account.
              </p>
              <Link
                href="/auth/login"
                className="text-gold hover:underline text-sm font-medium"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSignup} className="space-y-5">
                {error && (
                  <div className="px-4 py-3 rounded-xl bg-agent-rose/10 border border-agent-rose/20 text-agent-rose text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-text-secondary mb-1.5"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-boss-elevated border border-boss-border text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-gold/40 focus:ring-2 focus:ring-gold/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-text-secondary mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-boss-elevated border border-boss-border text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-gold/40 focus:ring-2 focus:ring-gold/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-text-secondary mb-1.5"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-boss-elevated border border-boss-border text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-gold/40 focus:ring-2 focus:ring-gold/20 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gold hover:bg-gold/90 text-boss-bg font-semibold text-sm transition-all disabled:opacity-50 cta-glow flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>

              <p className="text-center text-text-muted text-sm mt-6">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="text-gold hover:underline font-medium"
                >
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
