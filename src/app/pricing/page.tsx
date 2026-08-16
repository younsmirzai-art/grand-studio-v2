"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2, Shield, Zap, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FinalCTA } from "@/components/site/FinalCTA";

const freeFeatures = [
  "10 downloads per day",
  "Access to 10,000+ assets",
  "Sketchfab, Poly Haven & ambientCG",
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
  const [annual, setAnnual] = useState(false);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: annual ? "year" : "month" }),
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
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Start free. Upgrade when your workflow needs unlimited downloads and
          priority features.
        </p>

        <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-slate-900/60 backdrop-blur-md p-1">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ease-in-out ${
              !annual
                ? "bg-white/10 text-slate-100"
                : "text-slate-400 hover:text-slate-100"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ease-in-out ${
              annual
                ? "bg-white/10 text-slate-100"
                : "text-slate-400 hover:text-slate-100"
            }`}
          >
            Annual
          </button>
          <span className="mr-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#5E6AD2]/15 text-[#A5B4FC] border border-[#5E6AD2]/30">
            Save 20%
          </span>
        </div>
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
              className="gs-btn gs-btn-secondary gs-btn-lg gs-btn-full"
            >
              Sign up free
            </Link>
          </div>

          <div className="relative gs-feature-card p-8">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="text-[10px] px-3 py-1 rounded-full bg-[#5E6AD2] text-white font-semibold uppercase tracking-wider">
                Most Popular
              </span>
            </div>
            <div className="mb-6">
              <h2 className="font-display font-semibold text-2xl text-slate-100 mb-1">
                Pro
              </h2>
              <p className="text-sm text-slate-400">
                Unlimited access for serious creators.
              </p>
            </div>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="font-display font-bold text-5xl text-slate-100">
                {annual ? "$3.99" : "$4.99"}
              </span>
              <span className="text-slate-400 text-sm">/month</span>
            </div>
            {annual ? (
              <p className="text-xs text-slate-400 -mt-4 mb-6">
                $47.88 billed annually · 20% off
              </p>
            ) : null}
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
              className="gs-btn gs-btn-primary gs-btn-lg gs-btn-full"
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
