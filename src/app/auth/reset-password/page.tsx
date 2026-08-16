"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseAuthHash } from "@/lib/supabase/auth-hash";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      const supabase = createClient();
      const hashTokens = parseAuthHash(window.location.hash);
      if (hashTokens) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: hashTokens.access_token,
          refresh_token: hashTokens.refresh_token,
        });
        window.history.replaceState(null, "", window.location.pathname);
        if (sessionError) {
          router.replace(
            `/auth/forgot-password?error=${encodeURIComponent("Reset link expired")}`
          );
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        router.replace(
          `/auth/forgot-password?error=${encodeURIComponent("Reset link expired")}`
        );
        return;
      }
      setReady(true);
    }

    void establishSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const passwordError = useMemo(() => {
    if (!password || password.length >= 8) return "";
    return "Password must be at least 8 characters.";
  }, [password]);

  const confirmError = useMemo(() => {
    if (!confirm || confirm === password) return "";
    return "Passwords do not match.";
  }, [confirm, password]);

  const canSubmit =
    password.length >= 8 && confirm === password && !loading && ready;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      window.location.replace("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <AuthShell title="Reset password" subtitle="Checking your reset link…">
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a password with at least 8 characters"
      error={error}
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <PasswordInput
          id="new-password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={passwordError}
          showStrength
        />
        <PasswordInput
          id="confirm-password"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={confirmError}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Update password"
          )}
        </button>
      </form>
    </AuthShell>
  );
}
