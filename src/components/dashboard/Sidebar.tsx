"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  FolderOpen,
  Heart,
  Sparkles,
  Search,
  Rocket,
  CreditCard,
  Settings,
  LifeBuoy,
  Menu,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { FREE_DAILY_LIMIT } from "@/lib/plans";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: "NEW" | "SOON";
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    section: "Main",
    items: [
      { name: "Browse Models", href: "/browse", icon: Search },
      { name: "AI Generator", href: "/generate", icon: Sparkles, badge: "NEW" },
      { name: "My Library", href: "/library", icon: FolderOpen },
      { name: "Favorites", href: "/library?tab=favorites", icon: Heart },
    ],
  },
  {
    section: "Product",
    items: [
      { name: "UE5 Plugin", href: "/plugin", icon: Rocket, badge: "SOON" },
      { name: "Pricing", href: "/pricing", icon: CreditCard },
      { name: "Contact Support", href: "/support", icon: LifeBuoy },
    ],
  },
];

/** Only routes that actually exist — a 404 in the sidebar reads as unfinished. */
const legalLinks = [
  { name: "Privacy", href: "/privacy" },
  { name: "Terms", href: "/terms" },
];

function isActivePath(
  pathname: string,
  href: string,
  favoritesTab: boolean
): boolean {
  const [base, query] = href.split("?");
  const wantsFavorites = query?.includes("tab=favorites") ?? false;

  if (base === "/library") {
    const onLibrary =
      pathname === "/library" || pathname.startsWith("/library/");
    if (!onLibrary) return false;
    return wantsFavorites ? favoritesTab : !favoritesTab;
  }

  return pathname === base || pathname.startsWith(`${base}/`);
}

function SidebarInner({
  mobileOpen,
  setMobileOpen,
}: {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const favoritesTab = searchParams.get("tab") === "favorites";
  const [isFree, setIsFree] = useState(true);
  const [downloadsToday, setDownloadsToday] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadPlan() {
      const [usageResult] = await Promise.allSettled([
        fetch("/api/usage", { credentials: "include" }).then((res) =>
          res.ok ? res.json() : null
        ),
      ]);

      if (cancelled) return;

      const usage =
        usageResult.status === "fulfilled" ? usageResult.value : null;

      setDownloadsToday(usage?.downloadsToday ?? 0);
      setIsFree(usage?.tier !== "pro");
    }

    loadPlan().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const remaining = Math.max(0, FREE_DAILY_LIMIT - downloadsToday);
  const usagePct = Math.min(
    100,
    Math.round((downloadsToday / FREE_DAILY_LIMIT) * 100)
  );

  return (
    <>
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64
          bg-[#090D16]/80 backdrop-blur-xl border-r border-white/10
          transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="p-5 border-b border-white/10">
            <Link href="/browse" className="flex items-center gap-2.5 group">
              <div className="gs-mark w-9 h-9 text-sm">GS</div>
              <div>
                <div className="font-display font-semibold text-white text-sm tracking-tight">
                  Grand Studio
                </div>
                <div className="text-[10px] text-white/40">3D Model Hub</div>
              </div>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-6">
            {navigation.map((section) => (
              <div key={section.section}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 px-3 mb-2">
                  {section.section}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActivePath(
                      pathname,
                      item.href,
                      favoritesTab
                    );
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`
                          relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                          transition-all duration-200 ease-in-out group
                          ${
                            active
                              ? "bg-white/[0.06] text-slate-100"
                              : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
                          }
                        `}
                      >
                        {active ? (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-[#5E6AD2]" />
                        ) : null}
                        <item.icon
                          className={`w-4 h-4 ${
                            active
                              ? "text-[#A5B4FC]"
                              : "text-white/50 group-hover:text-white/70"
                          }`}
                        />
                        <span className="flex-1 font-medium">{item.name}</span>
                        {item.badge && (
                          <span
                            className={`
                              text-[9px] px-1.5 py-0.5 rounded font-bold
                              ${
                                item.badge === "NEW"
                                  ? "bg-purple-500/20 text-purple-300"
                                  : "bg-white/10 text-white/50"
                              }
                            `}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-4 border-t border-white/10">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-white">
                  {isFree ? "Free Plan" : "Pro Plan"}
                </span>
              </div>
              <div className="text-[11px] text-white/50 mb-3">
                {isFree
                  ? `${remaining} of ${FREE_DAILY_LIMIT} downloads left today`
                  : "Unlimited downloads"}
              </div>
              {isFree && (
                <div className="w-full h-1 rounded-full bg-white/5 mb-3">
                  <div
                    className="h-full rounded-full bg-[#5E6AD2]"
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
              )}
              {isFree ? (
                <Link
                  href="/pricing"
                  className="gs-btn gs-btn-primary gs-btn-sm gs-btn-full"
                >
                  Upgrade to Pro
                </Link>
              ) : (
                <Link
                  href="/settings"
                  className="gs-btn gs-btn-secondary gs-btn-sm gs-btn-full"
                >
                  Manage billing
                </Link>
              )}
            </div>

            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              className={`mt-3 relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ease-in-out ${
                pathname === "/settings" || pathname.startsWith("/settings/")
                  ? "bg-white/[0.06] text-slate-100"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="font-medium">Settings</span>
            </Link>

            <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-white/30">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-white/60 transition"
                >
                  {link.name}
                </Link>
              ))}
              <span>© {new Date().getFullYear()}</span>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[var(--gs-bg-surface)] border border-white/10"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <Suspense fallback={null}>
        <SidebarInner mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      </Suspense>
    </>
  );
}
