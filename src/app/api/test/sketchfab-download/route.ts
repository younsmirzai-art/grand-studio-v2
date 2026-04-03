import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://api.sketchfab.com/v3";

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid") ?? "15c79bb2fc1147128039fe4ff90fd5a0";
  const token = process.env.SKETCHFAB_API_TOKEN;
  const debug: Record<string, unknown> = { uid, tokenPresent: !!token };

  if (!token) {
    return NextResponse.json({
      success: false,
      error: "SKETCHFAB_API_TOKEN is not set",
      debug,
    }, { status: 500 });
  }

  try {
    const downloadApiUrl = `${BASE_URL}/models/${uid}/download`;
    console.log("[TEST SKETCHFAB-DOWNLOAD] Step 1: GET", downloadApiUrl);
    debug.step1_url = downloadApiUrl;

    const step1Res = await fetch(downloadApiUrl, {
      headers: { Authorization: `Token ${token}` },
      cache: "no-store",
    });
    debug.step1_status = step1Res.status;
    debug.step1_contentType = step1Res.headers.get("content-type") ?? null;
    console.log("[TEST SKETCHFAB-DOWNLOAD] Step 2: Status", step1Res.status, "Content-Type", debug.step1_contentType);

    const step1Text = await step1Res.text();
    debug.step1_bodyLength = step1Text.length;
    debug.step1_bodyPreview = step1Text.slice(0, 500);

    let step1Json: Record<string, unknown> | null = null;
    try {
      step1Json = JSON.parse(step1Text) as Record<string, unknown>;
      debug.step1_jsonKeys = Object.keys(step1Json);
      console.log("[TEST SKETCHFAB-DOWNLOAD] Step 3: JSON keys", debug.step1_jsonKeys);
    } catch {
      debug.step1_parseError = "Response is not JSON";
      return NextResponse.json({
        success: false,
        error: "Step 1 response is not JSON",
        debug,
      });
    }

    const glbUrl = (step1Json?.glb as { url?: string } | undefined)?.url;
    const gltfUrl = (step1Json?.gltf as { url?: string } | undefined)?.url;
    const sourceUrl = (step1Json?.source as { url?: string } | undefined)?.url;
    const downloadUrl = glbUrl ?? gltfUrl ?? sourceUrl ?? null;
    debug.step1_glbUrl = glbUrl ?? null;
    debug.step1_gltfUrl = gltfUrl ?? null;
    debug.step1_sourceUrl = sourceUrl ?? null;
    debug.step1_downloadUrlUsed = downloadUrl;

    if (!downloadUrl || typeof downloadUrl !== "string") {
      return NextResponse.json({
        success: false,
        error: "No glb, gltf, or source url in step 1 response",
        debug,
      });
    }

    console.log("[TEST SKETCHFAB-DOWNLOAD] Step 4: Following download URL", downloadUrl.slice(0, 80), "...");
    const step2Res = await fetch(downloadUrl, { cache: "no-store" });
    debug.step2_status = step2Res.status;
    debug.step2_contentType = step2Res.headers.get("content-type") ?? null;
    debug.step2_url = downloadUrl;
    console.log("[TEST SKETCHFAB-DOWNLOAD] Step 5: Step 2 status", step2Res.status, "Content-Type", debug.step2_contentType);

    const step2Buffer = await step2Res.arrayBuffer();
    const step2Bytes = new Uint8Array(step2Buffer);
    debug.step2_bodyLength = step2Bytes.length;
    const first20 = step2Bytes.slice(0, 20);
    const first20Hex = Array.from(first20).map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const first20Ascii = Array.from(first20).map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join("");
    debug.step2_first20BytesHex = first20Hex;
    debug.step2_first20BytesAscii = first20Ascii;

    const isGlb = step2Bytes.length >= 4 && first20[0] === 0x67 && first20[1] === 0x6c && first20[2] === 0x54 && first20[3] === 0x46;
    const isHtml = step2Bytes.length >= 1 && first20[0] === 0x3c;
    const isJson = step2Bytes.length >= 1 && first20[0] === 0x7b;
    debug.step2_isValidGLB = isGlb;
    debug.step2_looksLikeHTML = isHtml;
    debug.step2_looksLikeJSON = isJson;

    if (isGlb) {
      console.log("[TEST SKETCHFAB-DOWNLOAD] Step 6: File is valid GLB (magic glTF)");
    } else if (isHtml) {
      console.log("[TEST SKETCHFAB-DOWNLOAD] Step 6: File looks like HTML (starts with <)");
    } else if (isJson) {
      console.log("[TEST SKETCHFAB-DOWNLOAD] Step 6: File looks like JSON (starts with {)");
    } else {
      console.log("[TEST SKETCHFAB-DOWNLOAD] Step 6: Unknown format");
    }

    return NextResponse.json({
      success: step2Res.ok && isGlb,
      step1IsJson: true,
      step1HasDownloadUrl: !!downloadUrl,
      step2ContentType: debug.step2_contentType,
      step2BodyLength: debug.step2_bodyLength,
      step2IsValidGLB: isGlb,
      step2LooksLikeHTML: isHtml,
      step2LooksLikeJSON: isJson,
      debug,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[TEST SKETCHFAB-DOWNLOAD] Error:", message);
    debug.error = message;
    return NextResponse.json(
      { success: false, error: message, debug },
      { status: 500 }
    );
  }
}
