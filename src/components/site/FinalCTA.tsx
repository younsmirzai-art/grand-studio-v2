import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="gs-section-pro">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="gs-heading-xl mb-6">
          Ready to build something incredible?
        </h2>
        <p className="text-lg text-white/60 mb-8 max-w-2xl mx-auto">
          Join creators worldwide who are already using Grand Studio to
          accelerate their 3D projects.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-black font-semibold hover:bg-white/90 transition-colors"
          >
            Start free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
          >
            Browse models
          </Link>
        </div>

        <p className="text-xs text-white/40 mt-6">
          Free forever · No credit card required · 10 downloads daily
        </p>
      </div>
    </section>
  );
}
