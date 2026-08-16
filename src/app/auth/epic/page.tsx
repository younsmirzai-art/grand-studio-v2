"use client";

import { Suspense, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Gamepad2, ArrowRight } from "lucide-react";
import { createAuthClient } from "@/lib/supabase/auth-client";

const EPIC_AUTH_URL = "/api/auth/epic";

function EpicLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = useMemo(() => searchParams.get("error"), [searchParams]);

  useEffect(() => {
    createAuthClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data?.user) router.replace("/browse");
      });
  }, [router]);

  const handleSignIn = () => {
    window.location.href = EPIC_AUTH_URL;
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
            Sign in with Epic Games
          </h1>
          <p className="text-[#606068] text-sm mt-1">
            Use your Epic Games account to access Grand Studio and build with Unreal Engine 5.
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#111114]/80 backdrop-blur-xl p-8">
          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error.replace(/\+/g, " ")}
            </div>
          )}
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2196F3]/20 to-[#00BCD4]/20 border border-[#2196F3]/30 flex items-center justify-center">
              <Gamepad2 className="w-8 h-8 text-[#2196F3]" />
            </div>
            <p className="text-sm text-[#A0A0A8] text-center">
              One click connects your Epic Games account. No separate password to remember.
            </p>
            <button
              type="button"
              onClick={handleSignIn}
              className="w-full py-3.5 rounded-lg bg-[#1A1A1F] border border-white/10 text-white font-semibold text-sm hover:bg-white/10 hover:border-[#2196F3]/40 transition-all flex items-center justify-center gap-2"
            >
              <Gamepad2 className="w-4 h-4" />
              Sign in with Epic Games
            </button>
          </div>

          <p className="text-center text-[#606068] text-sm mt-6">
            Don&apos;t have an Epic Games account?{" "}
            <a
              href="https://www.epicgames.com/id/register"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2196F3] hover:underline"
            >
              Create one free
            </a>
          </p>

          <hr className="border-white/5 my-6" />

          <p className="text-center text-[#606068] text-sm">
            Prefer email?{" "}
            <Link href="/auth/login" className="text-[#2196F3] hover:underline font-medium">
              Sign in with email
            </Link>
            {" · "}
            <Link href="/auth/signup" className="text-[#2196F3] hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#606068] hover:text-[#A0A0A8] mt-6"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          Back to home
        </Link>
      </div>
    </div>
  );
}

export default function EpicLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center text-[#606068]">Loading...</div>}>
      <EpicLoginContent />
    </Suspense>
  );
}
