"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Circle, Rocket } from "lucide-react";

interface Step {
  id: string;
  label: string;
  href: string;
  done: boolean;
}

export function OnboardingChecklist() {
  const [steps, setSteps] = useState<Step[]>([
    { id: "account", label: "Create your account", href: "/settings", done: true },
    { id: "browse", label: "Explore the marketplace", href: "/browse", done: false },
    { id: "download", label: "Download your first model", href: "/browse", done: false },
    { id: "apikey", label: "Generate your plugin API key", href: "/settings", done: false },
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
        { id: "account", label: "Create your account", href: "/settings", done: true },
        {
          id: "browse",
          label: "Explore the marketplace",
          href: "/browse",
          done: downloads > 0,
        },
        {
          id: "download",
          label: "Download your first model",
          href: "/browse",
          done: downloads > 0,
        },
        {
          id: "apikey",
          label: "Generate your plugin API key",
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

  return (
    <div className="gs-card p-5 mb-8">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-sm text-white">Get started</h3>
        </div>
        <span className="text-xs text-white/50">
          {completed} of {steps.length} complete
        </span>
      </div>

      <div className="w-full h-1 rounded-full bg-white/5 mb-5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="space-y-1">
        {steps.map((step) => (
          <Link
            key={step.id}
            href={step.href}
            className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition group"
          >
            {step.done ? (
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-green-400" />
              </div>
            ) : (
              <Circle className="w-5 h-5 text-white/20 flex-shrink-0" />
            )}
            <span
              className={`text-sm flex-1 ${
                step.done
                  ? "text-white/40 line-through"
                  : "text-white/80 group-hover:text-white"
              }`}
            >
              {step.label}
            </span>
            {!step.done && (
              <span className="text-xs text-white/30 group-hover:text-cyan-400 transition">
                →
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
