"use client";

/**
 * Reserved for future browser ↔ plugin WebSocket. Not used in the app today (UE plugin uses
 * grandstudio.dev REST only). Optional override: NEXT_PUBLIC_WS_URL — not required for builds.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_WS_URL = "wss://grandstudio-ws.mydreamvalid35.workers.dev/ws";

function wsBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_WS_URL?.trim();
  return u && u.length > 0 ? u : DEFAULT_WS_URL;
}

export type PluginWsCommandPayload = {
  pythonCode: string;
  description: string;
};

export type PluginWsResult = {
  commandId: string;
  success: boolean;
  error?: string;
  message?: string;
};

type UsePluginWebSocketOptions = {
  /** When false, disconnect and skip fetching API key. */
  enabled: boolean;
};

function parseIncomingMessage(raw: string): {
  type?: string;
  commandId?: string;
  success?: boolean;
  error?: string;
  message?: string;
  role?: string;
  online?: boolean;
  pluginOnline?: boolean;
} | null {
  try {
    return JSON.parse(raw) as {
      type?: string;
      commandId?: string;
      success?: boolean;
      error?: string;
      message?: string;
      role?: string;
      online?: boolean;
      pluginOnline?: boolean;
    };
  } catch {
    return null;
  }
}

/**
 * Real-time link to the Cloudflare Worker WebSocket relay used by the UE5 Commander plugin.
 */
export function usePluginWebSocket({ enabled }: UsePluginWebSocketOptions) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyFetchDone, setKeyFetchDone] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isPluginOnline, setIsPluginOnline] = useState(false);
  const [lastResult, setLastResult] = useState<PluginWsResult | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const apiKeyRef = useRef<string | null>(null);

  apiKeyRef.current = apiKey;

  useEffect(() => {
    if (!enabled) {
      setApiKey(null);
      setKeyFetchDone(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/grand-studio-api-key", { credentials: "include" });
        const data = (await res.json()) as { apiKey?: string; hasKey?: boolean };
        if (cancelled) return;
        if (res.ok && typeof data.apiKey === "string" && data.apiKey.length > 0) {
          setApiKey(data.apiKey);
        } else {
          setApiKey(null);
        }
      } catch {
        if (!cancelled) setApiKey(null);
      } finally {
        if (!cancelled) setKeyFetchDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !keyFetchDone || !apiKey) {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setIsPluginOnline(false);
      intentionalCloseRef.current = false;
      return;
    }

    intentionalCloseRef.current = false;

    const connect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      const base = wsBaseUrl().replace(/\/$/, "");
      const url = `${base}?key=${encodeURIComponent(apiKeyRef.current ?? apiKey)}`;

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttemptRef.current = 0;
          setIsConnected(true);
          try {
            ws.send(
              JSON.stringify({
                type: "register",
                apiKey: apiKeyRef.current ?? apiKey,
                role: "site",
              }),
            );
          } catch {
            /* ignore */
          }
        };

        ws.onmessage = (event) => {
          const text = typeof event.data === "string" ? event.data : "";
          const msg = parseIncomingMessage(text);
          if (!msg?.type) return;

          switch (msg.type) {
            case "result": {
              const ok = (msg as { ok?: boolean }).ok;
              setLastResult({
                commandId: String(msg.commandId ?? ""),
                success: Boolean(msg.success ?? ok),
                error: typeof msg.error === "string" ? msg.error : undefined,
                message: typeof msg.message === "string" ? msg.message : undefined,
              });
              setIsPluginOnline(true);
              break;
            }
            case "plugin_online":
            case "plugin_connected":
              setIsPluginOnline(true);
              break;
            case "plugin_offline":
            case "plugin_disconnected":
              setIsPluginOnline(false);
              break;
            case "peer_online":
            case "peer":
              if (msg.role === "plugin") setIsPluginOnline(true);
              break;
            case "peer_offline":
              if (msg.role === "plugin") setIsPluginOnline(false);
              break;
            case "registered":
              if (typeof msg.pluginOnline === "boolean") {
                setIsPluginOnline(msg.pluginOnline);
              }
              break;
            case "status":
              if (typeof msg.online === "boolean") {
                setIsPluginOnline(msg.online);
              }
              if (typeof msg.pluginOnline === "boolean") {
                setIsPluginOnline(msg.pluginOnline);
              }
              break;
            default:
              break;
          }
        };

        ws.onerror = () => {
          /* onclose will handle reconnect */
        };

        ws.onclose = () => {
          wsRef.current = null;
          setIsConnected(false);
          if (!intentionalCloseRef.current && enabled && apiKeyRef.current) {
            const attempt = reconnectAttemptRef.current + 1;
            reconnectAttemptRef.current = attempt;
            const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt - 1, 5));
            reconnectTimerRef.current = setTimeout(() => {
              reconnectTimerRef.current = null;
              connect();
            }, delay);
          }
        };
      } catch {
        setIsConnected(false);
        reconnectAttemptRef.current += 1;
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(reconnectAttemptRef.current - 1, 5));
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      intentionalCloseRef.current = false;
    };
  }, [enabled, keyFetchDone, apiKey]);

  const sendCommand = useCallback((payload: PluginWsCommandPayload): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    const commandId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    try {
      ws.send(
        JSON.stringify({
          type: "command",
          commandId,
          pythonCode: payload.pythonCode,
          description: payload.description,
          steps: [],
        }),
      );
      return true;
    } catch {
      return false;
    }
  }, []);

  const hasApiKey = Boolean(apiKey);

  return {
    isConnected,
    isPluginOnline,
    sendCommand,
    lastResult,
    hasApiKey,
    keyFetchDone,
  };
}
