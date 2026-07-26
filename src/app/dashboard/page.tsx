"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CreditCard } from "lucide-react";
import { WelcomePanel } from "@/components/dashboard/WelcomePanel";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { getClient } from "@/lib/supabase/client";

const EarthScene = dynamic(
  () => import("@/components/dashboard/EarthScene").then((mod) => mod.EarthScene),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      </div>
    ),
  }
);

interface DownloadRecord {
  id: string;
  downloaded_at: string;
}

interface UserProfile {
  name: string;
  downloadsToday: number;
  favorites: number;
  isFree: boolean;
}

function countDownloadsToday(items: DownloadRecord[]): number {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return items.filter((item) => new Date(item.downloaded_at) >= startOfDay).length;
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({
    name: "Explorer",
    downloadsToday: 0,
    favorites: 0,
    isFree: true,
  });
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const supabase = getClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const name =
        (user.user_metadata?.name as string | undefined) ||
        user.email?.split("@")[0] ||
        "Explorer";

      if (!cancelled) {
        setProfile((prev) => ({ ...prev, name }));
      }

      const [subscriptionResult, downloadsResult] = await Promise.allSettled([
        supabase
          .from("subscriptions")
          .select("plan, status")
          .eq("user_id", user.id)
          .maybeSingle(),
        fetch("/api/download/history", { credentials: "include" }).then((res) =>
          res.ok ? res.json() : { items: [] }
        ),
      ]);

      if (cancelled) return;

      const subscription =
        subscriptionResult.status === "fulfilled" ? subscriptionResult.value.data : null;
      const downloads =
        downloadsResult.status === "fulfilled" && Array.isArray(downloadsResult.value.items)
          ? (downloadsResult.value.items as DownloadRecord[])
          : [];

      setProfile((prev) => ({
        ...prev,
        downloadsToday: countDownloadsToday(downloads),
        isFree: !(subscription?.plan === "pro" && subscription?.status === "active"),
      }));
      setLoading(false);
    }

    loadProfile().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      // Fall through to the pricing page if the portal is unavailable.
    }
    setPortalLoading(false);
    router.push("/pricing");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--gs-bg-base)]">
      <EarthScene />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(10, 10, 15, 0.4) 60%, rgba(10, 10, 15, 0.8) 100%)",
        }}
      />

      <div className="relative z-10 pb-24">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
          <WelcomePanel userName={profile.name} />

          <StatsGrid
            downloads={profile.downloadsToday}
            favorites={profile.favorites}
            isFree={profile.isFree}
            loading={loading}
          />

          <QuickActions />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.4 }}
            className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-center gap-3 text-sm"
          >
            <span className="px-3 py-1.5 rounded-lg gs-glass text-white/60">
              {profile.isFree ? "Free plan" : "Pro plan"}
            </span>

            {profile.isFree ? (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg gs-glass text-white/70 hover:text-white transition"
              >
                <CreditCard className="w-4 h-4" />
                Upgrade to Pro
              </Link>
            ) : (
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg gs-glass text-white/70 hover:text-white transition disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                {portalLoading ? "Opening…" : "Manage billing"}
              </button>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
