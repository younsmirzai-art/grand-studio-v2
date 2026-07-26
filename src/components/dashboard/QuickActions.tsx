"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Search, Sparkles, Compass, Rocket, type LucideIcon } from "lucide-react";

interface QuickAction {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  /** Static class strings — Tailwind cannot resolve runtime-built class names. */
  iconWrapper: string;
  iconColor: string;
  badge?: string;
}

const actions: QuickAction[] = [
  {
    icon: Search,
    title: "Browse Models",
    description: "Search through 500K+ models",
    href: "/browse",
    iconWrapper: "bg-cyan-500/10 border-cyan-500/20",
    iconColor: "text-cyan-400",
  },
  {
    icon: Sparkles,
    title: "AI Generator",
    description: "Create with text prompts",
    href: "/generate",
    iconWrapper: "bg-purple-500/10 border-purple-500/20",
    iconColor: "text-purple-400",
    badge: "NEW",
  },
  {
    icon: Compass,
    title: "Explore Categories",
    description: "Browse by theme",
    href: "/browse",
    iconWrapper: "bg-amber-500/10 border-amber-500/20",
    iconColor: "text-amber-400",
  },
  {
    icon: Rocket,
    title: "UE5 Plugin",
    description: "Coming to Fab Marketplace",
    href: "/plugin",
    iconWrapper: "bg-pink-500/10 border-pink-500/20",
    iconColor: "text-pink-400",
    badge: "SOON",
  },
];

export function QuickActions() {
  return (
    <div className="max-w-5xl mx-auto px-6 mb-12">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="text-lg font-display font-medium text-white/80 mb-4"
      >
        Quick Actions
      </motion.h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {actions.map((action, index) => (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.9 + index * 0.1 }}
          >
            <Link href={action.href} className="block group">
              <div className="gs-floating-panel p-5 flex items-center gap-4">
                <div
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${action.iconWrapper}`}
                >
                  <action.icon className={`w-5 h-5 ${action.iconColor}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold text-white truncate">
                      {action.title}
                    </h3>
                    {action.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-medium">
                        {action.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/50 truncate">
                    {action.description}
                  </p>
                </div>

                <div className="text-white/30 group-hover:text-white/60 group-hover:translate-x-1 transition-all">
                  →
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
