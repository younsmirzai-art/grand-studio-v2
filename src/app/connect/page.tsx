"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { Loader2, Download, ArrowRight } from "lucide-react";

const UE_IMPORT_HELP_URL =
  "https://dev.epicgames.com/documentation/en-us/unreal-engine/importing-assets-into-unreal-engine";

export default function ConnectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = createAuthClient();
    auth.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/auth/login?redirectTo=/connect");
        return;
      }
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#2196F3] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <header className="h-14 border-b border-white/5 bg-[#111114] flex items-center px-6 gap-4 sticky top-0 z-50">
        <Link href="/dashboard" className="text-sm font-bold tracking-[0.2em] uppercase text-white">
          GRAND STUDIO
        </Link>
        <div className="flex-1" />
        <Link href="/dashboard" className="text-xs text-[#606068] hover:text-white transition-colors">
          Dashboard
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-white mb-2">Unreal Engine 5 import</h1>
        <p className="text-sm text-[#A0A0A8] mb-10">
          Grand Studio no longer uses a Windows relay. Download model packages from any project&apos;s{" "}
          <strong className="text-white">3D Library</strong> tab, then import them manually in Unreal.
        </p>

        <div className="rounded-xl border border-white/10 bg-[#111114] p-6 space-y-4 mb-8">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2196F3]/15 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-[#2196F3]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">1. Prepare the file</h2>
              <p className="text-xs text-[#A0A0A8] leading-relaxed">
                In your project workspace, open <span className="text-white">3D Models</span> or{" "}
                <span className="text-white">Community</span>, click <span className="text-white">Import</span>, then{" "}
                <span className="text-white">Download</span> the ZIP when it is ready.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2196F3]/15 flex items-center justify-center shrink-0">
              <ArrowRight className="w-5 h-5 text-[#2196F3]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">2. Drag into UE5</h2>
              <p className="text-xs text-[#A0A0A8] leading-relaxed">
                Unzip the archive, open your UE5 project, go to the desired folder in Content Browser, and drag the{" "}
                <span className="text-white">.fbx</span> or <span className="text-white">.glb</span> in. Confirm the Import dialog.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2196F3] text-white text-sm font-semibold hover:bg-[#2196F3]/90 transition"
          >
            Back to dashboard
          </Link>
          <a
            href={UE_IMPORT_HELP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 text-sm text-[#A0A0A8] hover:text-white hover:border-white/25 transition"
          >
            Need help? Epic import documentation
          </a>
        </div>

        <p className="text-[11px] text-[#606068] mt-10 leading-relaxed">
          Optional: the <span className="text-[#A0A0A8]">Grand Studio Commander</span> Unreal plugin can run AI-generated Python inside the editor. That is separate from website downloads.
        </p>
      </main>
    </div>
  );
}
