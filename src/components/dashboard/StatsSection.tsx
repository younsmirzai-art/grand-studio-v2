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
  glow: string;
  progress?: number;
}

export function StatsSection() {
  const [stats, setStats] = useState<StatCard[]>([
    {
      label: "Downloads today",
      value: "—",
      trend: "Loading…",
      icon: Download,
      iconColor: "text-cyan-300",
      iconBg: "bg-cyan-500/15",
      glow: "shadow-[0_0_18px_rgba(34,211,238,0.25)]",
    },
    {
      label: "Total downloads",
      value: "—",
      trend: "All time",
      icon: TrendingUp,
      iconColor: "text-violet-300",
      iconBg: "bg-violet-500/15",
      glow: "shadow-[0_0_18px_rgba(167,139,250,0.25)]",
    },
    {
      label: "Favorites",
      value: "—",
      trend: "Saved models",
      icon: Heart,
      iconColor: "text-pink-300",
      iconBg: "bg-pink-500/15",
      glow: "shadow-[0_0_18px_rgba(244,114,182,0.22)]",
    },
    {
      label: "Plan",
      value: "—",
      trend: "Your subscription",
      icon: Crown,
      iconColor: "text-amber-300",
      iconBg: "bg-amber-500/15",
      glow: "shadow-[0_0_18px_rgba(251,191,36,0.22)]",
    },
  ]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/usage", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((usage: UsagePayload | null) => {
        if (cancelled || !usage) return;
        const tier = usage.tier === "pro" ? "Pro" : "Free";
        const limit = usage.dailyLimit ?? 10;
        const today = usage.downloadsToday ?? 0;
        const remainingTrend =
          usage.tier === "pro" ? "Unlimited" : `${usage.remaining ?? 0} remaining`;

        setStats([
          {
            label: "Downloads today",
            value: String(today),
            trend: remainingTrend,
            icon: Download,
            iconColor: "text-cyan-300",
            iconBg: "bg-cyan-500/15",
            glow: "shadow-[0_0_18px_rgba(34,211,238,0.25)]",
            progress:
              usage.tier === "pro" ? 100 : Math.min(100, Math.round((today / limit) * 100)),
          },
          {
            label: "Total downloads",
            value: String(usage.totalDownloads ?? 0),
            trend: "All time",
            icon: TrendingUp,
            iconColor: "text-violet-300",
            iconBg: "bg-violet-500/15",
            glow: "shadow-[0_0_18px_rgba(167,139,250,0.25)]",
          },
          {
            label: "Favorites",
            value: String(usage.favoritesCount ?? 0),
            trend: "Saved models",
            icon: Heart,
            iconColor: "text-pink-300",
            iconBg: "bg-pink-500/15",
            glow: "shadow-[0_0_18px_rgba(244,114,182,0.22)]",
          },
          {
            label: "Plan",
            value: tier,
            trend:
              usage.tier === "pro"
                ? "Unlimited downloads"
                : `${limit}/day free`,
            icon: Crown,
            iconColor: "text-amber-300",
            iconBg: "bg-amber-500/15",
            glow: "shadow-[0_0_18px_rgba(251,191,36,0.22)]",
            progress: usage.tier === "pro" ? 100 : 35,
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
              className={`w-9 h-9 rounded-xl ${stat.iconBg} flex items-center justify-center`}
            >
              <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
            </div>
          </div>
          <div className="text-2xl font-display font-semibold text-slate-100 tracking-tight mb-1">
            {stat.value}
          </div>
          <div className="text-xs text-slate-400 mb-1">{stat.label}</div>
          <div className="text-[11px] text-slate-500">{stat.trend}</div>
          {typeof stat.progress === "number" ? (
            <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#5E6AD2] transition-all duration-500 ease-in-out"
                style={{ width: `${stat.progress}%` }}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
