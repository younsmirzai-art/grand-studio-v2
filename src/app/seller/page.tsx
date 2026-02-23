"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Crown, DollarSign, Loader2, Star, BarChart3, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/collaboration/user";

interface Listing {
  id: string;
  title: string;
  price: number;
  is_free: boolean;
  status: string;
  rating: number;
  rating_count: number;
  download_count: number;
  revenue_total: number;
}

interface SellerData {
  listings: Listing[];
  totalRevenue: number;
  totalCommission: number;
  totalEarnings: number;
  thisMonth: { sales: number; revenue: number; downloads: number };
  purchasesByDay: { date: string; revenue: number; count: number }[];
}

export default function SellerPage() {
  const { userEmail } = getCurrentUser();
  const [email, setEmail] = useState(userEmail);
  const [data, setData] = useState<SellerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email.trim()) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/store/seller?userEmail=${encodeURIComponent(email.trim())}`)
      .then((res) => res.json())
      .then((d) => {
        setData({
          listings: d.listings ?? [],
          totalRevenue: d.totalRevenue ?? 0,
          totalCommission: d.totalCommission ?? 0,
          totalEarnings: d.totalEarnings ?? 0,
          thisMonth: d.thisMonth ?? { sales: 0, revenue: 0, downloads: 0 },
          purchasesByDay: d.purchasesByDay ?? [],
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [email]);

  const nextPayout = new Date();
  nextPayout.setMonth(nextPayout.getMonth() + 1);
  nextPayout.setDate(1);

  return (
    <div className="min-h-screen bg-boss-bg">
      <nav className="sticky top-0 z-40 border-b border-boss-border bg-boss-surface/95 glass-strong">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-primary">
            <Crown className="w-4 h-4 text-gold" />
            <span className="font-bold text-sm">Grand Studio</span>
          </Link>
          <div className="flex gap-2">
            <Link href="/store">
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                Store
              </Button>
            </Link>
            <Link href="/seller">
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                Seller
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2 mb-2">
          <DollarSign className="w-7 h-7 text-gold" />
          Seller Dashboard
        </h1>
        <p className="text-text-muted text-sm mb-6">Track revenue and manage your games.</p>

        <div className="mb-6 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-text-muted mb-1">Your email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seller@example.com"
              className="w-64 bg-boss-card border-boss-border text-text-primary"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
          </div>
        ) : !data ? (
          <div className="rounded-2xl border border-boss-border bg-boss-card p-8 text-center text-text-muted">
            Enter your email to see your seller dashboard.
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-boss-border bg-boss-card p-6 mb-8">
              <h2 className="text-sm font-semibold text-text-primary mb-4">Overview</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-text-muted">Total Revenue</p>
                  <p className="text-xl font-bold text-text-primary">${data.totalRevenue.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Your Earnings (70%)</p>
                  <p className="text-xl font-bold text-agent-green">${data.totalEarnings.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Platform Fee (30%)</p>
                  <p className="text-xl font-bold text-text-muted">${data.totalCommission.toFixed(2)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-boss-border bg-boss-card p-6 mb-8">
              <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                This Month
              </h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-text-muted">Sales</p>
                  <p className="text-lg font-semibold text-text-primary">{data.thisMonth.sales}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Revenue</p>
                  <p className="text-lg font-semibold text-text-primary">${data.thisMonth.revenue.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Downloads</p>
                  <p className="text-lg font-semibold text-text-primary">{data.thisMonth.downloads}</p>
                </div>
              </div>
              {data.purchasesByDay.length > 0 && (
                <div className="h-32 flex items-end gap-1">
                  {data.purchasesByDay.slice(-14).map((d) => (
                    <div
                      key={d.date}
                      className="flex-1 bg-gold/30 rounded-t min-w-[20px]"
                      style={{ height: `${Math.max(4, (d.revenue / Math.max(...data.purchasesByDay.map((x) => x.revenue), 1)) * 100)}%` }}
                      title={`${d.date}: $${d.revenue.toFixed(2)} (${d.count} sales)`}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-boss-border bg-boss-card p-6 mb-8">
              <h2 className="text-sm font-semibold text-text-primary mb-4">Your Games ({data.listings.length})</h2>
              {data.listings.length === 0 ? (
                <p className="text-text-muted text-sm">No games yet. Publish from a project.</p>
              ) : (
                <ul className="space-y-3">
                  {data.listings.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center justify-between py-3 border-b border-boss-border/50 last:border-0"
                    >
                      <div>
                        <p className="font-medium text-text-primary">{l.title}</p>
                        <p className="text-xs text-text-muted">
                          {l.is_free ? "FREE" : `$${Number(l.price).toFixed(2)}`} · {(l.rating ?? 0).toFixed(1)} ⭐ · {(l.download_count ?? 0)} downloads
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/store/${l.id}`}>
                          <Button variant="ghost" size="sm" className="text-text-secondary">View</Button>
                        </Link>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-boss-elevated text-text-muted capitalize">{l.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/" className="inline-block mt-4">
                <Button variant="outline" size="sm" className="border-boss-border">Share a project to publish</Button>
              </Link>
            </section>

            <section className="rounded-2xl border border-boss-border bg-boss-card p-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Payout Settings
              </h2>
              <p className="text-text-muted text-sm mb-2">Stripe Connect: Coming soon</p>
              <p className="text-xs text-text-muted">
                Next payout: ${data.totalEarnings.toFixed(2)} on {nextPayout.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </p>
              <Button variant="outline" size="sm" className="mt-3 border-boss-border text-text-muted" disabled>
                Payout History (coming soon)
              </Button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
