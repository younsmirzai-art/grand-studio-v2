"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Crown, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen bg-boss-bg flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-agent-green/20 border-2 border-agent-green/40 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-agent-green" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Thank you for subscribing</h1>
        <p className="text-text-muted mb-6">
          Your payment was successful. You now have full access to your plan.
          {sessionId && (
            <span className="block mt-2 text-xs text-text-muted font-mono">
              Session: {sessionId.slice(0, 20)}…
            </span>
          )}
        </p>
        <Link href="/">
          <Button className="bg-gold hover:bg-gold/90 text-boss-bg font-semibold gap-2">
            <Crown className="w-4 h-4" />
            Back to Grand Studio
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function SubscribeSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-boss-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
