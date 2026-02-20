import { getClient } from "./client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type ChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface SubscriptionConfig {
  table: string;
  event?: ChangeEvent;
  filter?: string;
  onData: (payload: Record<string, unknown>) => void;
}

export function subscribeToTable(
  channelName: string,
  config: SubscriptionConfig
): RealtimeChannel {
  const supabase = getClient();

  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: config.event ?? "*",
        schema: "public",
        table: config.table,
        filter: config.filter,
      },
      (payload) => {
        config.onData(payload.new as Record<string, unknown>);
      }
    )
    .subscribe();

  return channel;
}

export function unsubscribe(channel: RealtimeChannel) {
  const supabase = getClient();
  supabase.removeChannel(channel);
}
