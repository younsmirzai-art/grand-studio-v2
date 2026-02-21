"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Crown,
  Key,
  Plus,
  Loader2,
  Copy,
  Check,
  Trash2,
  BookOpen,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClient } from "@/lib/supabase/client";

const API_BASE = typeof window !== "undefined" ? window.location.origin : "";

interface ApiKeyRow {
  id: string;
  name: string;
  is_active: boolean;
  rate_limit: number;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  api_key_masked: string;
}

export default function DeveloperPage() {
  const [email, setEmail] = useState("");
  const [keyName, setKeyName] = useState("Default");
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/developer/keys?user_email=${encodeURIComponent(email.trim())}`
      );
      const data = await res.json();
      if (res.ok && data.keys) setKeys(data.keys);
      else setKeys([]);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!email.trim() || creating) return;
    setCreating(true);
    setNewKey(null);
    try {
      const res = await fetch("/api/developer/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_email: email.trim(),
          name: keyName.trim() || "Default",
        }),
      });
      const data = await res.json();
      if (res.ok && data.api_key) {
        setNewKey(data.api_key);
        fetchKeys();
      } else {
        alert(data.error ?? "Failed to create key");
      }
    } catch (e) {
      alert(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this key? It will stop working immediately.")) return;
    try {
      const res = await fetch(`/api/developer/keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });
      if (res.ok) fetchKeys();
    } catch (e) {
      alert(String(e));
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const usageToday = (k: ApiKeyRow) => {
    const last = k.last_used_at ? new Date(k.last_used_at) : null;
    const today = new Date().toISOString().slice(0, 10);
    const lastDay = last ? last.toISOString().slice(0, 10) : null;
    return lastDay === today ? k.usage_count : 0;
  };

  return (
    <div className="min-h-screen bg-boss-bg">
      <nav className="sticky top-0 z-40 border-b border-boss-border bg-boss-surface/95 glass-strong">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-primary">
            <Crown className="w-4 h-4 text-gold" />
            <span className="font-bold text-sm">Grand Studio</span>
          </Link>
          <div className="flex gap-2">
            <Link href="/marketplace">
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                Marketplace
              </Button>
            </Link>
            <Link href="/publish">
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                Publish
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Zap className="w-8 h-8 text-gold" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Grand Studio API</h1>
            <p className="text-text-muted text-sm mt-0.5">
              Use the API to create projects, build games, chat with agents, and run UE5 code.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-boss-border bg-boss-card p-6 mb-8">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
            <Key className="w-5 h-5" />
            Your API Keys
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <Input
              type="email"
              placeholder="Your email (to list or create keys)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-xs bg-boss-surface border-boss-border text-text-primary"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={fetchKeys}
              disabled={loading || !email.trim()}
              className="border-boss-border text-text-secondary"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "List keys"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <Input
              placeholder="Key name (e.g. Default)"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="max-w-xs bg-boss-surface border-boss-border text-text-primary"
            />
            <Button
              onClick={handleCreate}
              disabled={creating || !email.trim()}
              className="bg-gold hover:bg-gold/90 text-boss-bg gap-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Generate New Key
            </Button>
          </div>
          {newKey && (
            <div className="p-4 rounded-lg bg-agent-green/10 border border-agent-green/30 mb-4">
              <p className="text-sm text-text-primary mb-2">Copy your key now. It won&apos;t be shown again.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 rounded bg-boss-bg text-xs text-text-secondary font-mono break-all">
                  {newKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyKey(newKey)}
                  className="shrink-0 border-boss-border"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  Copy
                </Button>
              </div>
            </div>
          )}
          <ul className="space-y-3">
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-boss-surface border border-boss-border"
              >
                <div className="flex items-center gap-3">
                  <code className="text-sm text-text-secondary font-mono">{k.api_key_masked}</code>
                  <span className="text-sm text-text-muted">({k.name})</span>
                  {!k.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">Revoked</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span>Uses today: {usageToday(k)}/{k.rate_limit}</span>
                  {k.last_used_at && (
                    <span>Last: {new Date(k.last_used_at).toLocaleString()}</span>
                  )}
                </div>
                {k.is_active && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => handleRevoke(k.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {keys.length === 0 && email.trim() && !loading && (
            <p className="text-sm text-text-muted">No keys yet. Create one above.</p>
          )}
        </section>

        <section className="rounded-2xl border border-boss-border bg-boss-card p-6 mb-8">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5" />
            Quick Start
          </h2>
          <p className="text-sm text-text-muted mb-4">
            All v1 endpoints require header: <code className="text-text-secondary">X-API-Key: gs_live_...</code>
          </p>
          <pre className="p-4 rounded-lg bg-boss-bg border border-boss-border text-xs text-text-secondary font-mono overflow-x-auto mb-4">
{`curl -X POST ${API_BASE}/api/v1/projects \\
  -H "X-API-Key: gs_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My Game", "prompt": "Build a medieval castle"}'`}
          </pre>
          <p className="text-sm text-text-muted mb-2">Response:</p>
          <pre className="p-4 rounded-lg bg-boss-bg border border-boss-border text-xs text-text-secondary font-mono overflow-x-auto">
            {`{ "projectId": "...", "status": "created" }`}
          </pre>
        </section>

        <section className="rounded-2xl border border-boss-border bg-boss-card p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Endpoints</h2>
          <ul className="space-y-3 text-sm">
            <li>
              <code className="text-agent-green">POST /api/v1/projects</code> — Create project. Body:{" "}
              <code className="text-text-muted">{`{ name, prompt? }`}</code>
            </li>
            <li>
              <code className="text-agent-green">POST /api/v1/projects/:id/build</code> — Start full build. Body:{" "}
              <code className="text-text-muted">{`{ prompt? }`}</code>
            </li>
            <li>
              <code className="text-agent-green">GET /api/v1/projects/:id/status</code> — Build status.
            </li>
            <li>
              <code className="text-agent-green">POST /api/v1/agents/chat</code> — Chat with agent. Body:{" "}
              <code className="text-text-muted">{`{ projectId, agent, message }`}</code> — agents: nima, alex, thomas, elena, morgan, sana, amir
            </li>
            <li>
              <code className="text-agent-green">POST /api/v1/ue5/execute</code> — Run UE5 code. Body:{" "}
              <code className="text-text-muted">{`{ projectId, code, agent? }`}</code>
            </li>
            <li>
              <code className="text-agent-green">GET /api/v1/templates</code> — List game templates.
            </li>
            <li>
              <code className="text-agent-green">POST /api/v1/templates/:id/use</code> — Use template. Body:{" "}
              <code className="text-text-muted">{`{ projectId? }`}</code> — creates project if omitted.
            </li>
          </ul>
          <p className="text-xs text-text-muted mt-4">
            Rate limit: 100 requests per day per key (configurable). Keys start with <code>gs_</code>.
          </p>
        </section>
      </main>
    </div>
  );
}
