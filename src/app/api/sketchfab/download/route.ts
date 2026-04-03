import { NextRequest, NextResponse } from "next/server";
import { getDownloadUrl } from "@/lib/sketchfab/client";
import { createClient } from "@supabase/supabase-js";
import { createServerAuthClient } from "@/lib/supabase/server";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

const UPGRADE_MSG = "You've reached your daily community import limit. Upgrade to Pro for unlimited imports!";

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { uid, projectId } = (await request.json()) as {
      uid: string;
      projectId?: string;
    };

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    console.log(`DOWNLOAD REQUESTED: uid=${uid}`);

    const limitCheck = await checkUsageLimit(userId, "sketchfab_import");
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: UPGRADE_MSG, limitReached: true }, { status: 403 });
    }

    const token = process.env.SKETCHFAB_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "SKETCHFAB_API_TOKEN not configured" },
        { status: 500 }
      );
    }

    const supabase = getServiceClient();

    // Sketchfab download links expire after a few minutes. Never reuse cached URLs — a stale URL can fail or, worse, be inconsistent with a cluttered local extract dir on the client.
    const downloadUrl = await getDownloadUrl(uid, token);
    if (!downloadUrl) {
      return NextResponse.json(
        { error: "Could not get download URL. Model may not be downloadable." },
        { status: 404 }
      );
    }

    const low = downloadUrl.toLowerCase();
    const ext = low.includes(".glb") ? "glb" : low.includes(".zip") ? "zip" : "bin";
    await supabase.from("downloaded_assets").upsert({
      source: "sketchfab",
      source_id: uid,
      name: uid,
      storage_url: downloadUrl,
      format: ext,
      file_size_bytes: 0,
      license: "CC-BY",
    }, { onConflict: "source,source_id" });

    await recordUsage(userId, "sketchfab_import");
    return NextResponse.json({ url: downloadUrl });
  } catch (err) {
    console.error("[sketchfab/download] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Download failed" },
      { status: 500 }
    );
  }
}
