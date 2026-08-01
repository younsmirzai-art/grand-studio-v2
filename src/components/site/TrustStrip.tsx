import { Shield, CreditCard, FileCheck, Headphones } from "lucide-react";

const items = [
  {
    icon: Shield,
    title: "Secure by design",
    body: "Auth via Supabase. API keys rotatable from Settings.",
  },
  {
    icon: CreditCard,
    title: "Stripe billing",
    body: "Industry-standard payments. Cancel anytime.",
  },
  {
    icon: FileCheck,
    title: "Clear licensing",
    body: "License context shown so you can ship with confidence.",
  },
  {
    icon: Headphones,
    title: "Human support",
    body: "Contact us anytime — we respond to real creators.",
  },
];

export function TrustStrip() {
  return (
    <section className="gs-section-pro border-y border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="gs-eyebrow inline-flex mb-4">
            <span>Trust</span>
          </div>
          <h2 className="gs-heading-lg mb-3">Built like a real product team.</h2>
          <p className="text-white/55 max-w-2xl mx-auto">
            Security, billing, licensing, and support — the boring essentials that
            make a marketplace trustworthy.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.title} className="gs-feature-card">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <item.icon className="w-4 h-4 text-cyan-400" />
              </div>
              <h3 className="font-display font-semibold text-white mb-1.5">
                {item.title}
              </h3>
              <p className="text-sm text-white/55 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
