"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

interface Step {
  id: string;
  label: string;
  href: string;
  done: boolean;
}

export function OnboardingChecklist() {
  const [steps, setSteps] = useState<Step[]>([
    { id: "account", label: "Create account", href: "/settings", done: true },
    { id: "browse", label: "Explore marketplace", href: "/browse", done: false },
    { id: "download", label: "First download", href: "/browse", done: false },
    { id: "apikey", label: "Plugin API key", href: "/settings", done: false },
  ]);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [downloadsResult, keyResult] = await Promise.allSettled([
        fetch("/api/download/history", { credentials: "include" }).then((res) =>
          res.ok ? res.json() : { items: [] }
        ),
        fetch("/api/user/grand-studio-api-key", { credentials: "include" }).then(
          (res) => (res.ok ? res.json() : { hasKey: false })
        ),
      ]);

      if (cancelled) return;

      const downloads =
        downloadsResult.status === "fulfilled" &&
        Array.isArray(downloadsResult.value.items)
          ? downloadsResult.value.items.length
          : 0;
      const hasKey =
        keyResult.status === "fulfilled" ? Boolean(keyResult.value.hasKey) : false;

      const next: Step[] = [
        { id: "account", label: "Create account", href: "/settings", done: true },
        {
          id: "browse",
          label: "Explore marketplace",
          href: "/browse",
          done: downloads > 0,
        },
        {
          id: "download",
          label: "First download",
          href: "/browse",
          done: downloads > 0,
        },
        {
          id: "apikey",
          label: "Plugin API key",
          href: "/settings",
          done: hasKey,
        },
      ];

      setSteps(next);
      setDismissed(next.every((step) => step.done));
    }

    load().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed) return null;

  const completed = steps.filter((step) => step.done).length;
  const percent = Math.round((completed / steps.length) * 100);
  const firstOpen = steps.findIndex((step) => !step.done);

  return (
    <div className="gs-card p-5 mb-8">
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm text-slate-100">Get started</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {completed} of {steps.length} complete
          </p>
        </div>
        <span className="text-[11px] font-medium text-slate-400 tabular-nums">
          {percent}%
        </span>
      </div>

      <div className="w-full h-1 rounded-full bg-white/5 mb-6 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#5E6AD2] transition-all duration-500 ease-in-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step, index) => {
          const active = index === firstOpen;
          return (
            <li key={step.id}>
              <Link
                href={step.href}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-all duration-200 ease-in-out ${
                  step.done
                    ? "border-emerald-400/20 bg-emerald-500/10"
                    : active
                      ? "border-[#5E6AD2]/40 bg-[#5E6AD2]/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                }`}
              >
                {step.done ? (
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </span>
                ) : (
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${
                      active
                        ? "bg-[#5E6AD2] text-white"
                        : "bg-white/10 text-slate-400"
                    }`}
                  >
                    {index + 1}
                  </span>
                )}
                <span
                  className={`text-xs font-medium leading-snug ${
                    step.done
                      ? "text-emerald-300"
                      : active
                        ? "text-slate-100"
                        : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
