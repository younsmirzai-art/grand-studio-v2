"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Download, Heart, Crown, type LucideIcon } from "lucide-react";

interface UsagePayload {
  tier?: string;
  downloadsToday?: number;
  totalDownloads?: number;
  favoritesCount?: number;
  remaining?: number | null;
  dailyLimit?: number | null;
}

interface StatCard {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}

export function StatsSection() {
  const [stats, setStats] = useState<StatCard[]>([
    {
      label: "Downloads today",
      value: "—",
      trend: "Loading…",
      icon: Download,
      iconColor: "text-cyan-400",
      iconBg: "bg-cyan-500/10",
    },
    {
      label: "Total downloads",
      value: "—",
      trend: "All time",
      icon: TrendingUp,
      iconColor: "text-purple-400",
      iconBg: "bg-purple-500/10",
    },
    {
      label: "Favorites",
      value: "—",
      trend: "Saved models",
      icon: Heart,
      iconColor: "text-pink-400",
      iconBg: "bg-pink-500/10",
    },
    {
      label: "Plan",
      value: "—",
      trend: "Your subscription",
      icon: Crown,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10",
    },
  ]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/usage", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((usage: UsagePayload | null) => {
        if (cancelled || !usage) return;
        const tier = usage.tier === "pro" ? "Pro" : "Free";
        const remainingTrend =
          usage.tier === "pro"
            ? "Unlimited"
            : `${usage.remaining ?? 0} remaining`;

        setStats([
          {
            label: "Downloads today",
            value: String(usage.downloadsToday ?? 0),
            trend: remainingTrend,
            icon: Download,
            iconColor: "text-cyan-400",
            iconBg: "bg-cyan-500/10",
          },
          {
            label: "Total downloads",
            value: String(usage.totalDownloads ?? 0),
            trend: "All time",
            icon: TrendingUp,
            iconColor: "text-purple-400",
            iconBg: "bg-purple-500/10",
          },
          {
            label: "Favorites",
            value: String(usage.favoritesCount ?? 0),
            trend: "Saved models",
            icon: Heart,
            iconColor: "text-pink-400",
            iconBg: "bg-pink-500/10",
          },
          {
            label: "Plan",
            value: tier,
            trend:
              usage.tier === "pro"
                ? "Unlimited downloads"
                : `${usage.dailyLimit ?? 10}/day free`,
            icon: Crown,
            iconColor: "text-amber-400",
            iconBg: "bg-amber-500/10",
          },
        ]);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="gs-card p-4">
          <div className="flex items-start justify-between mb-3">
            <div
              className={`w-9 h-9 rounded-lg ${stat.iconBg} flex items-center justify-center`}
            >
              <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
            </div>
          </div>
          <div className="text-2xl font-display font-bold text-white mb-1">
            {stat.value}
          </div>
          <div className="text-xs text-white/50 mb-1">{stat.label}</div>
          <div className="text-[10px] text-white/40">{stat.trend}</div>
        </div>
      ))}
    </div>
  );
}
