"use client";

import { createAuthClient } from "@/lib/supabase/auth-client";
import { getClient } from "@/lib/supabase/client";
import { STRIPE_PRICES } from "@/lib/stripe/config";
import type { Project } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Folder, Clock, LogOut, Search, Plug, CreditCard } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState, useCallback } from "react";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [subscription, setSubscription] = useState<{ plan: string; status: string } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState("");

  useEffect(() => {
    const auth = createAuthClient();
    auth.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/auth/login");
        return;
      }
      setUser({ id: data.user.id, email: data.user.email ?? undefined });
    });
  }, [router]);

  const fetchProjects = useCallback(async () => {
    const supabase = getClient();
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setProjects(data as Project[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) fetchProjects();
  }, [user, fetchProjects]);

  useEffect(() => {
    if (!user) return;
    const supabase = getClient();
    supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setSubscription(data ?? null));
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    console.log("[Dashboard] Dashboard loaded for user", user.id, user.email ?? "(no email)");
    console.log("[Dashboard] Checking welcome email status");
    let cancelled = false;
    (async () => {
      try {
        console.log("[Dashboard] Calling welcome email API for", user.email);
        const res = await fetch("/api/email/welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        if (data.sent === false && data.reason === "already_sent") {
          console.log("[Dashboard] Welcome email already sent, skipping");
          return;
        }
        if (res.ok && data.sent === true) {
          console.log("[Dashboard] Welcome email sent successfully to", user.email);
          return;
        }
        if (!res.ok) {
          console.log("[Dashboard] Welcome email error:", data.error ?? res.status);
        }
      } catch (e) {
        if (!cancelled) console.log("[Dashboard] Welcome email error: details", e);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.email]);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else if (data.error) alert(data.error);
    } finally {
      setPortalLoading(false);
    }
  };

  const handleUpgradeToPro = async () => {
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId: STRIPE_PRICES.pro }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else if (data.error) alert(data.error);
    } finally {
      setUpgradeLoading(false);
    }
  };

  const isProOrTeam = subscription?.plan === "pro" || subscription?.plan === "team";
  const subscriptionActive = subscription?.status === "active";

  const handleSignOut = async () => {
    const auth = createAuthClient();
    await auth.auth.signOut();
    router.replace("/");
  };

  const handleCreate = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    setUpgradeModalOpen(false);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName.trim(), initial_prompt: newPrompt.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        router.push(`/project/${data.id}`);
        return;
      }
      if (res.status === 403 && data.limitReached) {
        setUpgradeModalMessage(data.error || "You can only have 2 projects on the Free plan. Upgrade to Pro for up to 10 projects!");
        setUpgradeModalOpen(true);
        return;
      }
      if (data.error) alert(data.error);
    } finally {
      setCreating(false);
    }
  };

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      {/* Top bar */}
      <header className="h-14 border-b border-white/5 bg-[#111114] flex items-center px-6 gap-4 sticky top-0 z-50">
        <Link href="/dashboard" className="text-sm font-bold tracking-[0.2em] uppercase text-white">
          GRAND STUDIO
        </Link>
        <div className="flex-1" />
        <Link
          href="/connect"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#606068] hover:text-white hover:bg-white/5 transition"
        >
          <Plug className="w-3.5 h-3.5" />
          Connect UE5
        </Link>
        <Link
          href="/support"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#606068] hover:text-white hover:bg-white/5 transition"
        >
          Support
        </Link>
        {isProOrTeam && subscriptionActive ? (
          <button
            onClick={handleManageSubscription}
            disabled={portalLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#606068] hover:text-white hover:bg-white/5 transition disabled:opacity-50"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Manage Subscription
          </button>
        ) : (
          <button
            onClick={handleUpgradeToPro}
            disabled={upgradeLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#2196F3] to-[#1976D2] text-white hover:brightness-110 transition disabled:opacity-50"
          >
            {upgradeLoading ? "Redirecting…" : "Upgrade to Pro"}
          </button>
        )}
        {user?.email && (
          <span className="text-xs text-[#606068] hidden sm:flex sm:items-center sm:gap-2">
            <span>{user.email}</span>
            <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-medium text-[#A0A0A8]">
              {!subscription || subscription.status !== "active" ? "Free Plan" : subscription.plan === "team" ? "Team Plan" : subscription.plan === "pro" ? "Pro Plan" : "Free Plan"}
            </span>
          </span>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-xs text-[#606068] hover:text-white transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#2196F3] to-[#1976D2] text-white text-xs font-semibold hover:brightness-110 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          NEW PROJECT
        </button>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Search */}
        <div className="relative mb-8 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606068]" />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#111114] border border-white/5 rounded-xl text-sm text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/40 transition"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#111114] border border-white/5 rounded-2xl p-6 animate-pulse">
                <div className="h-5 w-2/3 bg-white/5 rounded mb-3" />
                <div className="h-3 w-1/3 bg-white/5 rounded mb-4" />
                <div className="h-3 w-full bg-white/5 rounded mb-2" />
                <div className="h-3 w-4/5 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 && !search ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <div className="w-20 h-20 rounded-2xl bg-[#111114] border border-white/5 flex items-center justify-center mb-6">
              <Folder className="w-8 h-8 text-[#606068]" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Create Your First Scene</h2>
            <p className="text-sm text-[#606068] mb-6 max-w-sm text-center">
              Start a new project and describe the 3D scene you want to build. Grand Studio will bring it to life in Unreal Engine 5.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#2196F3] to-[#1976D2] text-white text-sm font-semibold hover:brightness-110 transition"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          </motion.div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#606068] text-center py-12">No projects match &quot;{search}&quot;</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
                onClick={() => router.push(`/project/${project.id}`)}
                className="bg-[#111114] border border-white/5 rounded-2xl p-6 cursor-pointer transition-colors hover:border-[#2196F3]/30 group"
              >
                <h3 className="font-semibold text-white mb-1 group-hover:text-[#2196F3] transition-colors">
                  {project.name}
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] text-[#606068] mb-3">
                  <Clock className="w-3 h-3" />
                  {new Date(project.created_at).toLocaleDateString()}
                </div>
                {project.initial_prompt && (
                  <p className="text-xs text-[#808088] line-clamp-2 leading-relaxed">
                    {project.initial_prompt}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-[#111114] border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
          >
            <h2 className="text-lg font-semibold mb-4">New Project</h2>
            <label className="block text-xs text-[#606068] mb-1.5">Project Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="My Scene"
              className="w-full px-3 py-2 bg-[#0A0A0B] border border-white/5 rounded-lg text-sm text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/40 mb-4"
              autoFocus
            />
            <label className="block text-xs text-[#606068] mb-1.5">Initial Prompt (optional)</label>
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Describe what you want to build…"
              rows={3}
              className="w-full px-3 py-2 bg-[#0A0A0B] border border-white/5 rounded-lg text-sm text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/40 resize-none mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs text-[#606068] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#2196F3] to-[#1976D2] text-white text-sm font-semibold hover:brightness-110 transition disabled:opacity-40"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Upgrade limit modal */}
      {upgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUpgradeModalOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-[#111114] border border-[#2196F3]/20 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
          >
            <h2 className="text-lg font-semibold text-white mb-2">You&apos;ve reached your limit</h2>
            <p className="text-sm text-[#A0A0A8] mb-4">{upgradeModalMessage}</p>
            <p className="text-xs text-[#606068] mb-6">
              Pro includes unlimited AI messages, unlimited model imports, 10 projects, and more.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setUpgradeModalOpen(false)}
                className="px-4 py-2 text-sm text-[#606068] hover:text-white transition-colors"
              >
                Maybe later
              </button>
              <button
                onClick={() => { setUpgradeModalOpen(false); handleUpgradeToPro(); }}
                disabled={upgradeLoading}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white text-sm font-semibold hover:brightness-110 transition disabled:opacity-50"
              >
                Upgrade to Pro — $19/month
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
