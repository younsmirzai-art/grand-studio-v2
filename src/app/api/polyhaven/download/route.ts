import { NextRequest, NextResponse } from "next/server";
import { getTextureDownloadUrls, getHDRIDownloadUrl } from "@/lib/polyhaven/client";
import { downloadPolyHavenModelToStorage } from "@/lib/polyhaven/downloadToSupabase";
import { createClient } from "@supabase/supabase-js";
import { createServerAuthClient } from "@/lib/supabase/server";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

const UPGRADE_MSG = "You've reached your daily model import limit. Upgrade to Pro for unlimited imports!";

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const { assetId, type, resolution, projectId } = (await request.json()) as {
      assetId: string;
      type: string;
      resolution?: string;
      projectId?: string;
    };

    if (!assetId) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }

    if (type === "model" || type === "models") {
      const limitCheck = await checkUsageLimit(userId, "polyhaven_import");
      if (!limitCheck.allowed) {
        return NextResponse.json({ error: UPGRADE_MSG, limitReached: true }, { status: 403 });
      }
      const url = await downloadPolyHavenModelToStorage(assetId);
      if (!url) {
        return NextResponse.json({ error: "No download URL found for this asset" }, { status: 404 });
      }
      await recordUsage(userId, "polyhaven_import");
      return NextResponse.json({ url });
    }

    if (type === "texture" || type === "textures") {
      const textures = await getTextureDownloadUrls(assetId, resolution ?? "1k");
      return NextResponse.json({ textures, cached: false });
    }

    if (type === "hdri" || type === "hdris") {
      const limitCheck = await checkUsageLimit(userId, "polyhaven_import");
      if (!limitCheck.allowed) {
        return NextResponse.json({ error: UPGRADE_MSG, limitReached: true }, { status: 403 });
      }
      const downloadUrl = await getHDRIDownloadUrl(assetId, resolution ?? "2k");
      if (!downloadUrl) {
        return NextResponse.json({ error: "No download URL found for this asset" }, { status: 404 });
      }
      const supabase = getServiceClient();
      const fileRes = await fetch(downloadUrl, { cache: "no-store" });
      if (!fileRes.ok) {
        return NextResponse.json({ error: "Failed to download model" }, { status: 502 });
      }
      const blob = await fileRes.blob();
      const storagePath = `polyhaven/${assetId}.hdr`;
      const { error: uploadErr } = await supabase.storage
        .from("polyhaven-assets")
        .upload(storagePath, blob, {
          contentType: blob.type || "application/octet-stream",
          upsert: true,
        });
      if (uploadErr) {
        return NextResponse.json({ url: downloadUrl, cached: false });
      }
      const { data: publicUrl } = supabase.storage.from("polyhaven-assets").getPublicUrl(storagePath);
      await supabase.from("downloaded_assets").upsert({
        source: "polyhaven",
        source_id: assetId,
        name: assetId.replace(/_/g, " "),
        storage_url: publicUrl.publicUrl,
        format: "hdr",
        file_size_bytes: blob.size,
        license: "CC0",
      }, { onConflict: "source,source_id" });
      await recordUsage(userId, "polyhaven_import");
      return NextResponse.json({ url: publicUrl.publicUrl, cached: false });
    }

    return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  } catch (err) {
    console.error("[polyhaven/download] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Download failed" },
      { status: 500 }
    );
  }
}
