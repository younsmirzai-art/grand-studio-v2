import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type ScanAsset = {
  path?: string;
  name?: string;
  type?: string;
  size_bytes?: number | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      projectId,
      assets,
    } = body as {
      userId?: string;
      projectId?: string;
      assets?: ScanAsset[] | { assets?: ScanAsset[] };
    };

    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const normalizedAssets = Array.isArray(assets)
      ? assets
      : Array.isArray(assets?.assets)
        ? assets.assets
        : [];

    console.log(
      `[scan-results-upload] Received scan upload: userId=${userId} projectId=${projectId ?? "null"} assets=${normalizedAssets.length}`
    );

    const supabase = createServerClient();
    const { error } = await supabase.from("scanned_assets").insert({
      user_id: userId,
      project_id: projectId ?? null,
      assets: normalizedAssets,
    });
    if (error) {
      console.error(`[scan-results-upload] Error: ${error.message}`);
      throw new Error(error.message);
    }

    console.log(`[scan-results-upload] Saved to database (${normalizedAssets.length} assets)`);
    return NextResponse.json({ success: true, count: normalizedAssets.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[scan-results-upload] Error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

