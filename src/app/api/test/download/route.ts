import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const assetId = request.nextUrl.searchParams.get("assetId") ?? "ceramic_vase_03";
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
    console.log("[TEST DOWNLOAD]", msg);
  };

  try {
    log(`Step 1: Get download URL for assetId=${assetId}`);
    const filesRes = await fetch(`https://api.polyhaven.com/files/${assetId}`, {
      headers: { "User-Agent": "GrandStudio/1.0" },
      cache: "no-store",
    });
    log(`Step 2: Files API status ${filesRes.status}`);
    if (!filesRes.ok) {
      const errText = await filesRes.text();
      return NextResponse.json({
        success: false,
        error: `Files API failed: ${filesRes.status}`,
        logs,
        details: errText.slice(0, 500),
      });
    }

    const filesData = await filesRes.json();
    log(`Step 3: Files response keys: ${Object.keys(filesData).join(", ")}`);

    let downloadUrl: string | null = null;
    if (filesData.gltf) {
      const gltf = filesData.gltf;
      const resKeys = typeof gltf === "object" && gltf !== null ? Object.keys(gltf) : [];
      log(`Step 4: gltf sub-keys: ${resKeys.join(", ")}`);
      const oneK = gltf["1k"] ?? gltf["2k"];
      if (oneK) {
        downloadUrl = oneK.url ?? oneK.gltf?.url ?? null;
        if (downloadUrl) log(`Step 5: Found gltf.1k.url or gltf.2k.url: ${downloadUrl.slice(0, 80)}...`);
      }
    }
    if (!downloadUrl && filesData["1k"]?.gltf?.url) {
      downloadUrl = filesData["1k"].gltf.url;
      log(`Step 5 (alt): Found 1k.gltf.url`);
    }
    if (!downloadUrl) {
      return NextResponse.json({
        success: false,
        error: "No gltf.1k.url or gltf.2k.url in files response",
        logs,
        filesSample: JSON.stringify(filesData).slice(0, 800),
      });
    }

    log(`Step 6: Downloading file from Poly Haven`);
    const fileRes = await fetch(downloadUrl, { cache: "no-store" });
    log(`Step 7: Download status ${fileRes.status}`);
    if (!fileRes.ok) {
      return NextResponse.json({
        success: false,
        error: `Download failed: ${fileRes.status}`,
        logs,
      });
    }
    const blob = await fileRes.blob();
    log(`Step 8: Blob size ${blob.size} bytes`);

    const ext = downloadUrl.includes(".glb") ? "glb" : "gltf";
    const storagePath = `polyhaven/${assetId}.${ext}`;
    log(`Step 9: Uploading to Supabase bucket polyhaven-assets path ${storagePath}`);

    const supabase = getServiceClient();
    const { error: uploadErr } = await supabase.storage
      .from("polyhaven-assets")
      .upload(storagePath, blob, {
        contentType: blob.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadErr) {
      log(`Step 10: Upload error: ${uploadErr.message}`);
      return NextResponse.json({
        success: false,
        error: "Supabase upload failed",
        uploadError: uploadErr.message,
        logs,
      });
    }

    const { data: publicUrl } = supabase.storage.from("polyhaven-assets").getPublicUrl(storagePath);
    log(`Step 10: Upload OK. Public URL: ${publicUrl.publicUrl?.slice(0, 80)}...`);

    return NextResponse.json({
      success: true,
      logs,
      publicUrl: publicUrl.publicUrl,
      blobSize: blob.size,
      storagePath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Error: ${message}`);
    return NextResponse.json(
      { success: false, error: message, logs },
      { status: 500 }
    );
  }
}
