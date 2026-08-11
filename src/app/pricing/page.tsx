"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2, Shield, Zap, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FinalCTA } from "@/components/site/FinalCTA";

const freeFeatures = [
  "10 downloads per day",
  "Access to 500K+ models",
  "Poly Haven, Sketchfab & more",
  "Standard formats (FBX, GLB, OBJ)",
  "Community support",
];

const proFeatures = [
  "Unlimited downloads",
  "Priority AI generations",
  "Early access to new features",
  "Priority email support",
  "No ads",
  "Commercial workflow friendly",
];

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}

function PricingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const canceled = searchParams.get("canceled") === "true";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpgrade = async () => {
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login?redirect=/pricing");
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        setError(data.error || "Checkout failed. Please try again.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Checkout failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-28 pb-8">
      <section className="max-w-7xl mx-auto px-6 mb-16 text-center">
        <div className="gs-eyebrow gs-eyebrow-cyan inline-flex mb-4">
          <span>Pricing</span>
        </div>
        <h1 className="gs-heading-xl mb-4">Simple, honest pricing</h1>
        <p className="text-lg text-white/60 max-w-2xl mx-auto">
          Start free. Upgrade when your workflow needs unlimited downloads and
          priority features.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 mb-20">
        {canceled && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm text-center">
            Checkout canceled — no charge was made. You can try again anytime.
          </div>
        )}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="gs-feature-card p-8">
            <div className="mb-6">
              <h2 className="font-display font-semibold text-2xl text-white mb-1">
                Free
              </h2>
              <p className="text-sm text-white/60">
                Everything you need to get started.
              </p>
            </div>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="font-display font-bold text-5xl text-white">
                $0
              </span>
              <span className="text-white/50 text-sm">forever</span>
            </div>
            <ul className="space-y-3 mb-8">
              {freeFeatures.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-white/70"
                >
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/auth/signup"
              className="block w-full text-center px-5 py-3 rounded-lg bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition"
            >
              Sign up free
            </Link>
          </div>

          <div className="relative gs-feature-card p-8 border-purple-500/30 bg-purple-500/5">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="text-[10px] px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold uppercase tracking-wider">
                Recommended
              </span>
            </div>
            <div className="mb-6">
              <h2 className="font-display font-semibold text-2xl text-white mb-1">
                Pro
              </h2>
              <p className="text-sm text-white/60">
                Unlimited access for serious creators.
              </p>
            </div>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="font-display font-bold text-5xl text-white">
                $4.99
              </span>
              <span className="text-white/50 text-sm">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              {proFeatures.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-white/70"
                >
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full px-5 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Upgrade to Pro"
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-white/40 mt-8">
          Cancel anytime. No hidden fees. Instant activation.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: Shield,
              title: "Secure billing",
              body: "Payments handled by Stripe. We never store card numbers.",
            },
            {
              icon: Zap,
              title: "Instant access",
              body: "Pro unlocks immediately after checkout succeeds.",
            },
            {
              icon: Download,
              title: "Fair free tier",
              body: "10 downloads every day, forever — no trial cliff.",
            },
          ].map((item) => (
            <div key={item.title} className="gs-feature-card p-5">
              <item.icon className="w-4 h-4 text-cyan-400 mb-3" />
              <div className="text-sm font-semibold text-white mb-1">
                {item.title}
              </div>
              <p className="text-xs text-white/50 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <FinalCTA />
    </div>
  );
}
