import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Welcome to Pro",
  description: "Your Grand Studio Pro subscription is active.",
};

export default function PricingSuccessPage() {
  return (
    <div className="min-h-screen pt-28 pb-16 flex items-center justify-center px-4">
      <div className="text-center max-w-md gs-card p-10">
        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="text-3xl font-display font-bold text-white mb-3">
          Welcome to Pro!
        </h1>
        <p className="text-white/55 mb-8 leading-relaxed">
          Your subscription is active. Enjoy unlimited downloads and priority
          features.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-semibold hover:opacity-90 transition"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/browse"
            className="px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition"
          >
            Start Downloading
          </Link>
        </div>
      </div>
    </div>
  );
}
