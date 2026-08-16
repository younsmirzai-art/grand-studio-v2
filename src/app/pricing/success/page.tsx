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
            href="/browse"
            className="gs-btn gs-btn-primary gs-btn-lg"
          >
            Go to catalog
          </Link>
          <Link href="/browse" className="gs-btn gs-btn-secondary gs-btn-lg">
            Start Downloading
          </Link>
        </div>
      </div>
    </div>
  );
}
