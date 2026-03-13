import { NextRequest, NextResponse } from "next/server";
import { getModelDownloadUrl, getTextureDownloadUrls, getHDRIDownloadUrl } from "@/lib/polyhaven/client";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const { assetId, type, resolution, projectId } = (await request.json()) as {
      assetId: string;
      type: string;
      resolution?: string;
      projectId?: string;
    };

    if (!assetId) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Check if already downloaded
    const { data: existing } = await supabase
      .from("downloaded_assets")
      .select("storage_url")
      .eq("source", "polyhaven")
      .eq("source_id", assetId)
      .maybeSingle();

    if (existing?.storage_url) {
      return NextResponse.json({ url: existing.storage_url, cached: true });
    }

    let downloadUrl: string | null = null;
    let format = "gltf";

    if (type === "model" || type === "models") {
      downloadUrl = await getModelDownloadUrl(assetId, resolution ?? "1k");
    } else if (type === "texture" || type === "textures") {
      const textures = await getTextureDownloadUrls(assetId, resolution ?? "1k");
      // For textures, return the URLs directly (no need to re-host)
      return NextResponse.json({ textures, cached: false });
    } else if (type === "hdri" || type === "hdris") {
      downloadUrl = await getHDRIDownloadUrl(assetId, resolution ?? "2k");
      format = "hdr";
    }

    if (!downloadUrl) {
      return NextResponse.json({ error: "No download URL found for this asset" }, { status: 404 });
    }

    // Download the file
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) {
      return NextResponse.json({ error: "Failed to download from Poly Haven" }, { status: 502 });
    }
    const blob = await fileRes.blob();
    const ext = format === "hdr" ? "hdr" : downloadUrl.includes(".glb") ? "glb" : "gltf";
    const storagePath = `polyhaven/${assetId}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from("polyhaven-assets")
      .upload(storagePath, blob, {
        contentType: blob.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[polyhaven/download] Upload error:", uploadErr);
      // Still return the direct URL as fallback
      await supabase.from("downloaded_assets").upsert({
        source: "polyhaven",
        source_id: assetId,
        name: assetId.replace(/_/g, " "),
        storage_url: downloadUrl,
        format: ext,
        file_size_bytes: blob.size,
        license: "CC0",
      }, { onConflict: "source,source_id" });
      return NextResponse.json({ url: downloadUrl, cached: false });
    }

    const { data: publicUrl } = supabase.storage
      .from("polyhaven-assets")
      .getPublicUrl(storagePath);

    // Record in downloaded_assets
    await supabase.from("downloaded_assets").upsert({
      source: "polyhaven",
      source_id: assetId,
      name: assetId.replace(/_/g, " "),
      storage_url: publicUrl.publicUrl,
      format: ext,
      file_size_bytes: blob.size,
      license: "CC0",
    }, { onConflict: "source,source_id" });

    return NextResponse.json({ url: publicUrl.publicUrl, cached: false });
  } catch (err) {
    console.error("[polyhaven/download] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Download failed" },
      { status: 500 }
    );
  }
}
