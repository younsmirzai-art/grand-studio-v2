"use client";

import { useEffect, useState } from "react";
import { KeyRound, Copy, Check, RefreshCw, Eye, EyeOff } from "lucide-react";

interface KeyStatus {
  hasKey: boolean;
  keySuffix?: string;
  apiKey?: string;
}

export function ApiKeySection() {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/grand-studio-api-key", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { hasKey: false }))
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus({ hasKey: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function mutateKey(regenerate: boolean) {
    if (regenerate && !window.confirm("Rotate your API key? The current key stops working immediately.")) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/user/grand-studio-api-key", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStatus({
        hasKey: true,
        apiKey: data.apiKey,
        keySuffix: data.apiKey?.slice(-4),
      });
      setRevealed(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!status?.apiKey) return;
    await navigator.clipboard.writeText(status.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="gs-card">
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-4 h-4 text-white/60" />
          <h3 className="font-semibold text-white">API Keys</h3>
        </div>
        <p className="text-xs text-white/50">
          Connect the Grand Studio AI Commander plugin for Unreal Engine
        </p>
      </div>

      <div className="p-5">
        {status === null ? (
          <div className="h-11 rounded-lg bg-white/5 animate-pulse" />
        ) : status.hasKey ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg font-mono text-sm">
              <span className="flex-1 truncate text-white/80">
                {revealed && status.apiKey
                  ? status.apiKey
                  : `gs_••••••••••••••••${status.keySuffix ?? ""}`}
              </span>
              {status.apiKey && (
                <>
                  <button
                    type="button"
                    onClick={() => setRevealed(!revealed)}
                    className="p-1.5 rounded hover:bg-white/10 transition text-white/50 hover:text-white"
                    aria-label={revealed ? "Hide API key" : "Reveal API key"}
                  >
                    {revealed ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={copyKey}
                    className="p-1.5 rounded hover:bg-white/10 transition text-white/50 hover:text-white"
                    aria-label="Copy API key"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => mutateKey(true)}
              disabled={busy}
              className="gs-btn gs-btn-ghost gs-btn-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
              Regenerate key
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-white/50">
              No API key yet. Generate one to connect the plugin.
            </p>
            <button
              type="button"
              onClick={() => mutateKey(false)}
              disabled={busy}
              className="gs-btn gs-btn-primary"
            >
              {busy ? "Generating…" : "Generate API key"}
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
