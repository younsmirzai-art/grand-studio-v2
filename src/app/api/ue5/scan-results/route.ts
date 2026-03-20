import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await createServerAuthClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const projectId = request.nextUrl.searchParams.get("projectId");
    const supabase = createServerClient();
    let query = supabase
      .from("scanned_assets")
      .select("assets, scanned_at, project_id")
      .eq("user_id", user.id)
      .order("scanned_at", { ascending: false })
      .limit(1);

    if (projectId) query = query.eq("project_id", projectId);

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);

    const assets = (data?.assets as unknown[]) ?? [];
    return NextResponse.json({
      success: true,
      assets,
      count: assets.length,
      scannedAt: data?.scanned_at ?? null,
      projectId: data?.project_id ?? projectId ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

