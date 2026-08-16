"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { User, Mail, CreditCard, Bell, Shield, FileText, LifeBuoy } from "lucide-react";
import { getClient } from "@/lib/supabase/client";
import { ApiKeySection } from "@/components/dashboard/ApiKeySection";

export default function SettingsPage() {
  const [userEmail, setUserEmail] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = getClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setUserEmail(user.email || "");

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", user.id)
        .maybeSingle();

      setIsFree(!(subscription?.plan === "pro" && subscription?.status === "active"));
    }
    load().catch(() => {});
  }, []);

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
      // Fall through to pricing.
    }
    setPortalLoading(false);
    window.location.href = "/pricing";
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight text-slate-100 mb-1">
          Settings
        </h1>
        <p className="text-sm text-slate-400">
          Manage your account and preferences.
        </p>
      </div>

      <div className="space-y-6">
        <div className="gs-card">
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-white/60" />
              <h3 className="font-semibold text-white">Account</h3>
            </div>
            <p className="text-xs text-slate-400">Your basic information</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Email</label>
              <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                <Mail className="w-4 h-4 text-white/40" />
                <span className="text-sm text-white/80">
                  {userEmail || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="gs-card">
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-white/60" />
              <h3 className="font-semibold text-white">Billing</h3>
            </div>
            <p className="text-xs text-white/50">Your subscription and plan</p>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg gap-4 flex-wrap">
              <div>
                <div className="text-sm font-medium text-white">
                  {isFree ? "Free Plan" : "Pro Plan"}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  {isFree ? "10 downloads/day" : "Unlimited downloads"}
                </div>
              </div>
              {isFree ? (
                <Link
                  href="/pricing"
                  className="gs-btn gs-btn-primary"
                >
                  Upgrade
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="gs-btn gs-btn-secondary"
                >
                  {portalLoading ? "Opening…" : "Manage billing"}
                </button>
              )}
            </div>
          </div>
        </div>

        <ApiKeySection />

        <div className="gs-card p-5 opacity-60">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-white/60" />
            <h3 className="font-semibold text-white">Notifications</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 ml-auto">
              Soon
            </span>
          </div>
          <p className="text-xs text-white/50">
            Configure how you receive updates
          </p>
        </div>

        <div className="gs-card p-5 opacity-60">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-white/60" />
            <h3 className="font-semibold text-white">Security</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 ml-auto">
              Soon
            </span>
          </div>
          <p className="text-xs text-white/50">Password and authentication</p>
        </div>

        <div className="gs-card">
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-white/60" />
              <h3 className="font-semibold text-white">Legal &amp; Support</h3>
            </div>
            <p className="text-xs text-white/50">
              Policies, terms, and how to reach us
            </p>
          </div>
          <div className="p-2">
            <Link
              href="/privacy"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition"
            >
              <Shield className="w-4 h-4 text-white/40" />
              <span className="flex-1">Privacy Policy</span>
              <span className="text-white/30">→</span>
            </Link>
            <Link
              href="/terms"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition"
            >
              <FileText className="w-4 h-4 text-white/40" />
              <span className="flex-1">Terms of Service</span>
              <span className="text-white/30">→</span>
            </Link>
            <Link
              href="/support"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition"
            >
              <LifeBuoy className="w-4 h-4 text-white/40" />
              <span className="flex-1">Contact Support</span>
              <span className="text-white/30">→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
