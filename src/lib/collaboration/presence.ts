"use client";

import { getClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PresenceUser {
  user_email: string;
  user_name: string;
  online_at: string;
}

export type PresenceState = Record<string, PresenceUser[]>;

export function subscribeToPresence(
  projectId: string,
  userEmail: string,
  userName: string,
  callbacks: {
    onSync?: (state: PresenceState) => void;
    onJoin?: (user: PresenceUser) => void;
    onLeave?: (user: PresenceUser) => void;
  }
): RealtimeChannel {
  const supabase = getClient();
  const channel = supabase.channel("project:" + projectId);

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as PresenceState;
      callbacks.onSync?.(state);
    })
    .on("presence", { event: "join" }, ({ newPresences }) => {
      const first = newPresences?.[0] as unknown as PresenceUser | undefined;
      if (first && (first.user_email !== userEmail || first.user_name !== userName)) {
        callbacks.onJoin?.(first);
      }
    })
    .on("presence", { event: "leave" }, ({ leftPresences }) => {
      const first = leftPresences?.[0] as unknown as PresenceUser | undefined;
      if (first) callbacks.onLeave?.(first);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_email: userEmail,
          user_name: userName,
          online_at: new Date().toISOString(),
        });
      }
    });

  return channel;
}

export function presenceStateToUsers(state: PresenceState): PresenceUser[] {
  const seen = new Set<string>();
  const users: PresenceUser[] = [];
  for (const key of Object.keys(state)) {
    const presences = state[key] as PresenceUser[];
    for (const p of presences) {
      if (p.user_email && !seen.has(p.user_email)) {
        seen.add(p.user_email);
        users.push(p);
      }
    }
  }
  return users;
}
