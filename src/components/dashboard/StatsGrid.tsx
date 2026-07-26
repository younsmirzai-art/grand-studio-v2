"use client";

import { motion } from "framer-motion";
import { Download, Heart, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";

interface StatsGridProps {
  downloads?: number;
  favorites?: number;
  isFree?: boolean;
  loading?: boolean;
}

interface StatCard {
  icon: LucideIcon;
  label: string;
  value: string;
  subtext: string;
  gradient: string;
  iconColor: string;
  href: string;
  featured?: boolean;
}

const FREE_DAILY_LIMIT = 10;

export function StatsGrid({
  downloads = 0,
  favorites = 0,
  isFree = true,
  loading = false,
}: StatsGridProps) {
  const remaining = Math.max(0, FREE_DAILY_LIMIT - downloads);

  const stats: StatCard[] = [
    {
      icon: Download,
      label: isFree ? "Downloads today" : "Downloads",
      value: loading ? "—" : downloads.toString(),
      subtext: isFree ? `${remaining} of ${FREE_DAILY_LIMIT} remaining` : "Unlimited",
      gradient: "from-cyan-500/20 to-blue-500/20",
      iconColor: "text-cyan-400",
      href: "/library",
    },
    {
      icon: Heart,
      label: "Favorites",
      value: loading ? "—" : favorites.toString(),
      subtext: "Your collection",
      gradient: "from-pink-500/20 to-rose-500/20",
      iconColor: "text-pink-400",
      href: "/library?tab=favorites",
    },
    {
      icon: Sparkles,
      label: "AI Generator",
      value: "New",
      subtext: "Try it now →",
      gradient: "from-purple-500/20 to-violet-500/20",
      iconColor: "text-purple-400",
      href: "/generate",
      featured: true,
    },
    {
      icon: TrendingUp,
      label: "Browse",
      value: "500K+",
      subtext: "Models available",
      gradient: "from-amber-500/20 to-orange-500/20",
      iconColor: "text-amber-400",
      href: "/browse",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto px-6 mb-12">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
        >
          <Link href={stat.href} className="block group h-full">
            <div
              className={`gs-floating-panel p-6 h-full group-hover:scale-[1.02] transition-transform ${
                stat.featured ? "gs-animate-pulse-glow" : ""
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-4 border border-white/5`}
              >
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>

              <div className="text-2xl md:text-3xl font-display font-bold text-white mb-1">
                {stat.value}
              </div>

              <div className="text-sm text-white/60 mb-2">{stat.label}</div>

              <div
                className={`text-xs ${
                  stat.featured ? "text-purple-400 font-medium" : "text-white/40"
                }`}
              >
                {stat.subtext}
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
