"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { getClient } from "@/lib/supabase/client";
import { Download, Wifi, WifiOff, Loader2, ArrowRight } from "lucide-react";

export default function ConnectPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [status, setStatus] = useState<{
    connected: boolean;
    lastPing: string | null;
    ue5Connected: boolean;
  }>({ connected: false, lastPing: null, ue5Connected: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = createAuthClient();
    auth.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/auth/login?redirectTo=/connect");
        return;
      }
      setUser({ id: data.user.id });
      setLoading(false);
    });
  }, [router]);

  const pollHeartbeat = useCallback(async () => {
    try {
      const supabase = getClient();
      const { data } = await supabase
        .from("relay_heartbeat")
        .select("last_ping, ue5_connected")
        .eq("id", "local-relay")
        .maybeSingle();

      const row = data as { last_ping?: string; ue5_connected?: boolean } | null;
      if (row?.last_ping) {
        const age = Date.now() - new Date(row.last_ping).getTime();
        setStatus({
          connected: age < 60_000,
          lastPing: row.last_ping,
          ue5Connected: row.ue5_connected === true,
        });
      } else {
        setStatus({ connected: false, lastPing: null, ue5Connected: false });
      }
    } catch {
      setStatus({ connected: false, lastPing: null, ue5Connected: false });
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    pollHeartbeat();
    const interval = setInterval(pollHeartbeat, 5000);
    return () => clearInterval(interval);
  }, [user, pollHeartbeat]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#2196F3] animate-spin" />
      </div>
    );
  }

  const downloadSetupScript = () => {
    window.open("/api/relay/setup-script", "_blank", "noopener");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <header className="h-14 border-b border-white/5 bg-[#111114] flex items-center px-6 gap-4 sticky top-0 z-50">
        <Link href="/dashboard" className="text-sm font-bold tracking-[0.2em] uppercase text-white">
          GRAND STUDIO
        </Link>
        <div className="flex-1" />
        <Link
          href="/dashboard"
          className="text-xs text-[#606068] hover:text-white transition-colors"
        >
          Dashboard
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-white mb-2">Connect UE5</h1>
        <p className="text-sm text-[#A0A0A8] mb-10">
          Run the relay on your PC so Grand Studio can send builds to Unreal Engine 5.
        </p>

        {/* Connection status */}
        <div
          className={`mb-10 flex items-center gap-3 px-4 py-3 rounded-xl border ${
            status.connected && status.ue5Connected
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-[#111114] border-white/10"
          }`}
        >
          {status.connected && status.ue5Connected ? (
            <>
              <Wifi className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-emerald-400">Connected</p>
                <p className="text-xs text-[#A0A0A8]">
                  Relay and UE5 are connected. You can build from any project.
                </p>
              </div>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-[#606068]" />
              <div>
                <p className="text-sm font-medium text-[#A0A0A8]">Not connected</p>
                <p className="text-xs text-[#606068]">
                  Complete the steps below and run the setup file. Status updates every 5 seconds.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#2196F3]/20 text-[#2196F3] flex items-center justify-center font-bold">
              1
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-white mb-1">Download the relay setup</h2>
              <p className="text-xs text-[#A0A0A8] mb-3">
                Get the Windows setup file. It will install the relay and configure it for this project.
              </p>
              <button
                onClick={downloadSetupScript}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#2196F3]/90 transition"
              >
                <Download className="w-4 h-4" />
                Download GrandStudio-Relay-Setup.bat
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#2196F3]/20 text-[#2196F3] flex items-center justify-center font-bold">
              2
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-white mb-1">Open UE5 and enable plugins</h2>
              <p className="text-xs text-[#A0A0A8]">
                In Unreal Engine 5: Edit → Plugins, then enable both: (1) <strong>Web Remote Control</strong> — for relay connection; (2) <strong>glTF Importer</strong> — for importing 3D models with materials and textures. Restart UE5 after enabling both.
                The relay will connect to UE5 at <code className="bg-white/5 px-1 rounded">localhost:30010</code>.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#2196F3]/20 text-[#2196F3] flex items-center justify-center font-bold">
              3
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-white mb-1">Run the setup file</h2>
              <p className="text-xs text-[#A0A0A8] mb-3">
                Double-click the downloaded .bat file. It will check for Python, download the relay, create the config, and start the relay. Keep the window open while using Grand Studio.
              </p>
              <p className="text-xs text-[#606068]">
                If Python is not installed, install it from{" "}
                <a
                  href="https://www.python.org/downloads/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2196F3] hover:underline"
                >
                  python.org
                </a>{" "}
                and make sure to check &quot;Add Python to PATH&quot;.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-[#2196F3] hover:underline"
          >
            <ArrowRight className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-[#606068] hover:text-white transition"
          >
            My projects
          </Link>
        </div>
      </main>
    </div>
  );
}
