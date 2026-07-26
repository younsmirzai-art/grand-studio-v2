"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Heart, Sparkles, Clock, type LucideIcon } from "lucide-react";

interface ActivityItem {
  id: string;
  type: "download" | "favorite" | "generate";
  icon: LucideIcon;
  action: string;
  subject: string;
  time: string;
  color: string;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

const PLACEHOLDER_ACTIVITIES: ActivityItem[] = [
  {
    id: "p1",
    type: "download",
    icon: Download,
    action: "Downloaded",
    subject: "Modern Beach House",
    time: "2 hours ago",
    color: "text-cyan-400",
  },
  {
    id: "p2",
    type: "favorite",
    icon: Heart,
    action: "Favorited",
    subject: "Sci-Fi Weapon Pack",
    time: "5 hours ago",
    color: "text-pink-400",
  },
  {
    id: "p3",
    type: "download",
    icon: Download,
    action: "Downloaded",
    subject: "Forest Trees Bundle",
    time: "Yesterday",
    color: "text-cyan-400",
  },
  {
    id: "p4",
    type: "generate",
    icon: Sparkles,
    action: "Generated",
    subject: "Custom cyberpunk robot",
    time: "2 days ago",
    color: "text-amber-400",
  },
  {
    id: "p5",
    type: "favorite",
    icon: Heart,
    action: "Favorited",
    subject: "Medieval Castle",
    time: "3 days ago",
    color: "text-pink-400",
  },
];

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [usingPlaceholder, setUsingPlaceholder] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/download/history", {
          credentials: "include",
        });
        const data = res.ok ? await res.json() : { items: [] };
        const items = Array.isArray(data.items) ? data.items : [];

        if (cancelled) return;

        if (items.length === 0) {
          setActivities(PLACEHOLDER_ACTIVITIES);
          setUsingPlaceholder(true);
        } else {
          setActivities(
            items.slice(0, 5).map(
              (item: {
                id: string;
                asset_name: string;
                downloaded_at: string;
              }) => ({
                id: item.id,
                type: "download" as const,
                icon: Download,
                action: "Downloaded",
                subject: item.asset_name || "Untitled model",
                time: formatRelativeTime(item.downloaded_at),
                color: "text-cyan-400",
              })
            )
          );
          setUsingPlaceholder(false);
        }
      } catch {
        if (!cancelled) {
          setActivities(PLACEHOLDER_ACTIVITIES);
          setUsingPlaceholder(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="gs-card">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-white/50" />
          <h3 className="font-semibold text-sm text-white">Recent Activity</h3>
        </div>
        <Link
          href="/library"
          className="text-xs text-white/50 hover:text-white transition"
        >
          View all →
        </Link>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-white/40">Loading…</div>
      ) : (
        <>
          {usingPlaceholder && (
            <div className="px-4 pt-3 text-[11px] text-white/35">
              Sample activity — your downloads will appear here
            </div>
          )}
          <div className="divide-y divide-white/5">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="p-4 flex items-center gap-3 hover:bg-white/[0.02] transition"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <activity.icon className={`w-3.5 h-3.5 ${activity.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">
                    <span className="text-white/60">{activity.action}</span>{" "}
                    <span className="font-medium">{activity.subject}</span>
                  </div>
                  <div className="text-xs text-white/40">{activity.time}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
