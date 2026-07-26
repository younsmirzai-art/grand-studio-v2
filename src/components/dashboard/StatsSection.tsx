"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Download, Heart, Sparkles, type LucideIcon } from "lucide-react";
import { getClient } from "@/lib/supabase/client";

interface StatCard {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}

const FREE_DAILY_LIMIT = 10;

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
      value: "0",
      trend: "Coming in Phase 6",
      icon: Heart,
      iconColor: "text-pink-400",
      iconBg: "bg-pink-500/10",
    },
    {
      label: "AI generations",
      value: "—",
      trend: "Coming in Phase 4",
      icon: Sparkles,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10",
    },
  ]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = getClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const [downloadsResult, usageResult] = await Promise.allSettled([
        fetch("/api/download/history", { credentials: "include" }).then((res) =>
          res.ok ? res.json() : { items: [] }
        ),
        fetch("/api/usage", { credentials: "include" }).then((res) =>
          res.ok ? res.json() : null
        ),
      ]);

      if (cancelled) return;

      const items =
        downloadsResult.status === "fulfilled" &&
        Array.isArray(downloadsResult.value.items)
          ? downloadsResult.value.items
          : [];

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayCount = items.filter(
        (item: { downloaded_at: string }) =>
          new Date(item.downloaded_at) >= startOfDay
      ).length;

      const usage =
        usageResult.status === "fulfilled" ? usageResult.value : null;
      const meshyUsed = usage?.meshy_generate?.used ?? 0;
      const meshyLimit = usage?.meshy_generate?.limit;
      const isUnlimited = meshyLimit === null || meshyLimit === -1 || meshyLimit > 9999;

      setStats([
        {
          label: "Downloads today",
          value: String(todayCount),
          trend: `${Math.max(0, FREE_DAILY_LIMIT - todayCount)} of ${FREE_DAILY_LIMIT} remaining`,
          icon: Download,
          iconColor: "text-cyan-400",
          iconBg: "bg-cyan-500/10",
        },
        {
          label: "Total downloads",
          value: String(items.length),
          trend: "Recent history",
          icon: TrendingUp,
          iconColor: "text-purple-400",
          iconBg: "bg-purple-500/10",
        },
        {
          label: "Favorites",
          value: "0",
          trend: "Coming in Phase 6",
          icon: Heart,
          iconColor: "text-pink-400",
          iconBg: "bg-pink-500/10",
        },
        {
          label: "AI generations",
          value: String(meshyUsed),
          trend: isUnlimited
            ? "Unlimited"
            : `Used of ${meshyLimit ?? "—"}`,
          icon: Sparkles,
          iconColor: "text-amber-400",
          iconBg: "bg-amber-500/10",
        },
      ]);
    }

    load().catch(() => {});
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
