import type { Metadata } from "next";
import Link from "next/link";
import { Check, Shield, Zap, Download } from "lucide-react";
import { FinalCTA } from "@/components/site/FinalCTA";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple pricing for Grand Studio. Start free with 10 downloads per day, or go Pro for unlimited access.",
};

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Everything you need to get started.",
    features: [
      "10 downloads per day",
      "Access to 500K+ models",
      "Poly Haven, Sketchfab & more",
      "Standard formats (FBX, GLB, OBJ)",
      "Community support",
    ],
    cta: "Start free",
    href: "/auth/signup",
    variant: "secondary" as const,
  },
  {
    name: "Pro",
    price: "$4.99",
    period: "/month",
    description: "Unlimited access for serious creators.",
    features: [
      "Unlimited downloads",
      "Priority AI generations",
      "Early access to new features",
      "Priority email support",
      "No ads",
      "Commercial workflow friendly",
    ],
    cta: "Get Pro",
    href: "/auth/signup",
    variant: "primary" as const,
    popular: true,
  },
];

const faqs = [
  {
    q: "Do I need a credit card for the free plan?",
    a: "No. Create an account and start downloading immediately — no card required.",
  },
  {
    q: "Can I cancel Pro anytime?",
    a: "Yes. Cancel from Settings → Billing. You keep Pro access until the end of the billing period.",
  },
  {
    q: "What licenses do models use?",
    a: "It depends on the source. Poly Haven assets are CC0. We surface license details on each model so you can use them confidently.",
  },
  {
    q: "Is the UE5 plugin included?",
    a: "The Grand Studio AI Commander plugin is a companion product heading to Fab. Your Grand Studio account connects via API key.",
  },
];

export default function PricingPage() {
  return (
    <div className="pt-28 pb-8">
      <section className="max-w-7xl mx-auto px-6 mb-16 text-center">
        <div className="gs-eyebrow gs-eyebrow-cyan inline-flex mb-4">
          <span>Pricing</span>
        </div>
        <h1 className="gs-heading-xl mb-4">Simple, honest pricing.</h1>
        <p className="text-lg text-white/60 max-w-2xl mx-auto">
          Start free. Upgrade when your workflow needs unlimited downloads and
          priority features.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative gs-feature-card p-8 ${
                plan.popular ? "border-purple-500/30 bg-purple-500/5" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="font-display font-semibold text-2xl text-white mb-1">
                  {plan.name}
                </h2>
                <p className="text-sm text-white/60">{plan.description}</p>
              </div>

              <div className="mb-6 flex items-baseline gap-1">
                <span className="font-display font-bold text-5xl text-white">
                  {plan.price}
                </span>
                <span className="text-white/50 text-sm">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
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
                href={plan.href}
                className={`block w-full text-center px-5 py-3 rounded-lg font-semibold transition-all ${
                  plan.variant === "primary"
                    ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:opacity-90"
                    : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

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

      <section className="max-w-3xl mx-auto px-6 mb-16">
        <h2 className="gs-heading-lg text-center mb-10">Questions</h2>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <div key={faq.q} className="gs-feature-card p-5">
              <h3 className="text-sm font-semibold text-white mb-2">{faq.q}</h3>
              <p className="text-sm text-white/55 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-white/40 mt-8">
          Still need help?{" "}
          <Link href="/support" className="text-cyan-400 hover:text-cyan-300">
            Contact support
          </Link>
        </p>
      </section>

      <FinalCTA />
    </div>
  );
}
