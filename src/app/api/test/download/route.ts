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

    // GLB then FBX only — matches production (no glTF — needs .bin sidecar)
    type Format = "glb" | "fbx";
    let downloadUrl: string | null = null;
    let ext: Format = "fbx";

    function pickUrl(formatKey: "glb" | "fbx"): string | null {
      const block = filesData[formatKey];
      if (!block || typeof block !== "object") return null;
      const oneK = block["1k"] ?? block["2k"];
      if (!oneK) return null;
      return oneK.url ?? oneK[formatKey]?.url ?? null;
    }

    if (filesData.glb) {
      downloadUrl = pickUrl("glb");
      if (downloadUrl) {
        ext = "glb";
        log(`Step 4: Found glb.1k/2k.url`);
      }
    }
    if (!downloadUrl && filesData.fbx) {
      downloadUrl = pickUrl("fbx");
      if (downloadUrl) {
        ext = "fbx";
        log(`Step 4: Found fbx.1k/2k.url (fallback)`);
      }
    }
    if (!downloadUrl) {
      return NextResponse.json({
        success: false,
        error: "No glb or fbx URL in files response",
        logs,
        filesSample: JSON.stringify(filesData).slice(0, 800),
      });
    }

    log(`Step 5: Downloading ${ext.toUpperCase()} from Poly Haven`);
    const fileRes = await fetch(downloadUrl, { cache: "no-store" });
    log(`Step 6: Download status ${fileRes.status}`);
    if (!fileRes.ok) {
      return NextResponse.json({
        success: false,
        error: `Download failed: ${fileRes.status}`,
        logs,
      });
    }
    const blob = await fileRes.blob();
    log(`Step 7: Blob size ${blob.size} bytes`);

    const storagePath = `polyhaven/${assetId}.${ext}`;
    log(`Step 8: Uploading to Supabase bucket polyhaven-assets path ${storagePath}`);

    const supabase = getServiceClient();
    const { error: uploadErr } = await supabase.storage
      .from("polyhaven-assets")
      .upload(storagePath, blob, {
        contentType: blob.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadErr) {
      log(`Step 9: Upload error: ${uploadErr.message}`);
      return NextResponse.json({
        success: false,
        error: "Supabase upload failed",
        uploadError: uploadErr.message,
        logs,
      });
    }

    const { data: publicUrl } = supabase.storage.from("polyhaven-assets").getPublicUrl(storagePath);
    log(`Step 9: Upload OK. Public URL: ${publicUrl.publicUrl?.slice(0, 80)}...`);

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
