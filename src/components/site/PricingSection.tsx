import Link from "next/link";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Perfect to get started",
    features: [
      "10 downloads per day",
      "Access to 10,000+ assets",
      "Sketchfab, Poly Haven & ambientCG",
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
    description: "For serious creators",
    features: [
      "Unlimited downloads",
      "Priority AI generations",
      "Early access to new features",
      "Priority support",
      "No ads",
    ],
    cta: "Get Pro",
    href: "/auth/signup",
    variant: "primary" as const,
    popular: true,
  },
];

export function PricingSection() {
  return (
    <section className="gs-section-pro border-y border-white/5 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gs-eyebrow gs-eyebrow-cyan inline-flex mb-4">
            <span>Pricing</span>
          </div>
          <h2 className="gs-heading-lg mb-4">Simple, honest pricing.</h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto">
            Start free. Upgrade when you need more.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative gs-feature-card p-8 ${
                plan.popular ? "border-white/16" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] px-3 py-1 rounded-full bg-[#5E6AD2] text-white font-semibold uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-display font-semibold text-2xl text-white mb-1">
                  {plan.name}
                </h3>
                <p className="text-sm text-white/60">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="font-display font-bold text-4xl text-white">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-white/50 text-sm">{plan.period}</span>
                  )}
                </div>
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
                className={`gs-btn gs-btn-lg gs-btn-full ${
                  plan.variant === "primary"
                    ? "gs-btn-primary"
                    : "gs-btn-secondary"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
