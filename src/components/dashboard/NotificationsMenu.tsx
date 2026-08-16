"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Sparkles, Rocket, Search, type LucideIcon } from "lucide-react";

interface ProductUpdate {
  id: string;
  title: string;
  body: string;
  date: string;
  icon: LucideIcon;
  iconColor: string;
  href: string;
}

/**
 * Product announcements rather than per-user alerts. The unread dot is driven by
 * the newest id versus what this browser has already seen, so it never shows a
 * badge the user cannot clear.
 */
const UPDATES: ProductUpdate[] = [
  {
    id: "2026-08-browse",
    title: "The catalog is the workspace",
    body: "Browse is now the main hall. Search every type of 3D asset in one place.",
    date: "Aug 2026",
    icon: Search,
    iconColor: "text-[#A5B4FC]",
    href: "/browse",
  },
  {
    id: "2026-07-generator",
    title: "AI Generator coming soon",
    body: "Text-to-3D generation is in development. Preview the interface now.",
    date: "Jul 2026",
    icon: Sparkles,
    iconColor: "text-purple-400",
    href: "/generate",
  },
  {
    id: "2026-07-plugin",
    title: "UE5 plugin heading to Fab",
    body: "Grand Studio AI Commander is being prepared for the Fab Marketplace.",
    date: "Jul 2026",
    icon: Rocket,
    iconColor: "text-pink-400",
    href: "/plugin",
  },
];

const STORAGE_KEY = "gs:last-seen-update";

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    try {
      setHasUnread(window.localStorage.getItem(STORAGE_KEY) !== UPDATES[0].id);
    } catch {
      // Private mode or storage disabled — treat as read.
    }
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && hasUnread) {
      setHasUnread(false);
      try {
        window.localStorage.setItem(STORAGE_KEY, UPDATES[0].id);
      } catch {
        // Non-fatal.
      }
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="p-2 rounded-lg hover:bg-white/5 transition relative"
        aria-label={hasUnread ? "What's new (unread)" : "What's new"}
      >
        <Bell className="w-4 h-4 text-white/60" />
        {hasUnread && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-80 gs-glass-strong rounded-lg border border-white/10 shadow-xl z-50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/5">
                <div className="text-sm font-semibold text-white">What&apos;s new</div>
                <div className="text-xs text-white/50">Product updates</div>
              </div>

              <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                {UPDATES.map((update) => (
                  <Link
                    key={update.id}
                    href={update.href}
                    onClick={() => setOpen(false)}
                    className="flex gap-3 p-4 hover:bg-white/5 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                      <update.icon className={`w-4 h-4 ${update.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white">
                        {update.title}
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed mt-0.5">
                        {update.body}
                      </p>
                      <div className="text-[10px] text-white/30 mt-1">
                        {update.date}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <Link
                href="/support"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-xs text-white/50 hover:text-white hover:bg-white/5 transition border-t border-white/5 text-center"
              >
                Have feedback? Contact us →
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
