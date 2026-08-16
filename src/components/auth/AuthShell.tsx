"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  error,
  errorTitle,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  error?: string;
  errorTitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--gs-bg-base,#0A0A0B)] flex items-center justify-center px-4 relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.12),transparent_55%)]" />

      <div className="relative z-10 w-full max-w-[420px]">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>

        <div className="text-center mb-8">
          <div className="gs-mark w-11 h-11 text-sm rounded-xl mx-auto mb-4">GS</div>
          <h1 className="text-2xl font-display font-bold text-white tracking-tight">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-white/50 text-sm mt-1.5">{subtitle}</p>
          ) : null}
        </div>

        <div className="gs-card p-8">
          {error ? (
            <div
              role="alert"
              className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
            >
              {errorTitle ? (
                <>
                  <p className="font-semibold text-red-300 mb-1">{errorTitle}</p>
                  <p>{error}</p>
                </>
              ) : (
                error
              )}
            </div>
          ) : null}

          {children}

          {footer ? (
            <p className="text-center text-white/45 text-sm mt-6">{footer}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
