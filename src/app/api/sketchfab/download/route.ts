import { NextRequest, NextResponse } from "next/server";
import { getDownloadUrl } from "@/lib/sketchfab/client";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const { uid, projectId } = (await request.json()) as {
      uid: string;
      projectId?: string;
    };

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    const token = process.env.SKETCHFAB_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "SKETCHFAB_API_TOKEN not configured" },
        { status: 500 }
      );
    }

    const supabase = getServiceClient();

    // Check cache
    const { data: existing } = await supabase
      .from("downloaded_assets")
      .select("storage_url")
      .eq("source", "sketchfab")
      .eq("source_id", uid)
      .maybeSingle();

    if (existing?.storage_url) {
      return NextResponse.json({ url: existing.storage_url, cached: true });
    }

    const downloadUrl = await getDownloadUrl(uid, token);
    if (!downloadUrl) {
      return NextResponse.json(
        { error: "Could not get download URL. Model may not be downloadable." },
        { status: 404 }
      );
    }

    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) {
      return NextResponse.json({ error: "Failed to download from Sketchfab" }, { status: 502 });
    }

    const blob = await fileRes.blob();
    const ext = downloadUrl.includes(".glb") ? "glb" : "gltf";
    const storagePath = `sketchfab/${uid}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("sketchfab-assets")
      .upload(storagePath, blob, {
        contentType: blob.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[sketchfab/download] Upload error:", uploadErr);
      return NextResponse.json({ url: downloadUrl, cached: false });
    }

    const { data: publicUrl } = supabase.storage
      .from("sketchfab-assets")
      .getPublicUrl(storagePath);

    await supabase.from("downloaded_assets").upsert({
      source: "sketchfab",
      source_id: uid,
      name: uid,
      storage_url: publicUrl.publicUrl,
      format: ext,
      file_size_bytes: blob.size,
      license: "CC-BY",
    }, { onConflict: "source,source_id" });

    return NextResponse.json({ url: publicUrl.publicUrl, cached: false });
  } catch (err) {
    console.error("[sketchfab/download] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Download failed" },
      { status: 500 }
    );
  }
}
