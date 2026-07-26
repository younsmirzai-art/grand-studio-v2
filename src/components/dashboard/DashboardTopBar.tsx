"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, LogOut, User, HelpCircle } from "lucide-react";
import { getClient } from "@/lib/supabase/client";

export function DashboardTopBar() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    async function loadUser() {
      const supabase = getClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        setUserName(
          (user.user_metadata?.name as string | undefined) ||
            user.email?.split("@")[0] ||
            "User"
        );
      }
    }
    loadUser().catch(() => {});
  }, []);

  async function handleSignOut() {
    setProfileOpen(false);
    await getClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-white/5 bg-[var(--gs-bg-base)]/80 backdrop-blur-xl">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex-1 max-w-lg ml-12 lg:ml-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models, categories..."
              className="w-full pl-10 pr-12 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/20 focus:bg-white/10 transition"
            />
            <kbd className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30 border border-white/10 rounded px-1.5 py-0.5">
              ⌘K
            </kbd>
          </div>
        </form>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-white/5 transition relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 text-white/60" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />
          </button>

          <Link
            href="/support"
            className="p-2 rounded-lg hover:bg-white/5 transition"
            aria-label="Help"
          >
            <HelpCircle className="w-4 h-4 text-white/60" />
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-white/5 transition"
              aria-label="Account menu"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-xs font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
            </button>

            <AnimatePresence>
              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                    aria-hidden
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 gs-glass-strong rounded-lg border border-white/10 shadow-xl z-50"
                  >
                    <div className="p-3 border-b border-white/5">
                      <div className="text-sm font-medium text-white truncate">
                        {userName}
                      </div>
                      <div className="text-xs text-white/50 truncate">
                        {userEmail}
                      </div>
                    </div>
                    <div className="p-1">
                      <Link
                        href="/settings"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-sm text-white/70 hover:text-white hover:bg-white/5 transition"
                      >
                        <User className="w-4 h-4" />
                        Account Settings
                      </Link>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-white/70 hover:text-white hover:bg-white/5 transition text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
