import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="gs-section-pro">
      <div className="max-w-5xl mx-auto px-6">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10 px-8 py-14 md:px-16 text-center">
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
            }}
          />
          <div className="relative z-10">
            <h2 className="gs-heading-xl mb-5">
              Ready to build something incredible?
            </h2>
            <p className="text-lg text-white/60 mb-8 max-w-2xl mx-auto">
              Join creators using Grand Studio to find, download, and ship 3D
              assets faster.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/auth/signup" className="gs-btn gs-btn-primary gs-btn-lg">
                Start free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/browse" className="gs-btn gs-btn-secondary gs-btn-lg">
                Browse models
              </Link>
            </div>

            <p className="text-xs text-white/40 mt-6">
              Free forever · No credit card required · 10 downloads daily
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
