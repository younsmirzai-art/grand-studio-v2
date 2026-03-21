import { NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";

/**
 * Debug: scanned_assets state for the signed-in user (no Supabase UI needed).
 */
export async function GET() {
  try {
    const auth = await createServerAuthClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createServerClient();

    const { count: rowCount, error: countErr } = await supabase
      .from("scanned_assets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countErr) throw new Error(countErr.message);

    const { data: latest, error: latestErr } = await supabase
      .from("scanned_assets")
      .select("assets, scanned_at, project_id")
      .eq("user_id", user.id)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestErr) throw new Error(latestErr.message);

    const assets = (latest?.assets as Array<{ name?: string; path?: string }> | null) ?? [];
    const assetCount = Array.isArray(assets) ? assets.length : 0;
    const firstNames = Array.isArray(assets)
      ? assets
          .slice(0, 5)
          .map((a) => (typeof a?.name === "string" ? a.name : typeof a?.path === "string" ? a.path : "(no name)"))
      : [];

    return NextResponse.json({
      ok: true,
      userId: user.id,
      hasAnyRows: (rowCount ?? 0) > 0,
      totalRowsForUser: rowCount ?? 0,
      latestScannedAt: latest?.scanned_at ?? null,
      latestProjectId: latest?.project_id ?? null,
      latestAssetCount: assetCount,
      firstFiveAssetNames: firstNames,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
