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

    console.log(`[scan-results] Fetching scan for user ${user.id}${projectId ? ` projectId=${projectId}` : ""}`);

    type Row = {
      assets: unknown;
      scanned_at: string | null;
      project_id: string | null;
    };

    let data: Row | null = null;
    let matchedProject = false;

    if (projectId) {
      const { data: exact, error: errExact } = await supabase
        .from("scanned_assets")
        .select("assets, scanned_at, project_id")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .order("scanned_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (errExact) throw new Error(errExact.message);
      if (exact) {
        data = exact as Row;
        matchedProject = true;
        const assets = (exact.assets as unknown[]) ?? [];
        console.log(
          `[scan-results] Found scan for exact projectId match with ${assets.length} assets from date ${exact.scanned_at ?? "unknown"}`
        );
      } else {
        console.log(`[scan-results] No scan found for user + projectId=${projectId}; falling back to latest user scan`);
      }
    }

    if (!data) {
      const { data: latest, error: errLatest } = await supabase
        .from("scanned_assets")
        .select("assets, scanned_at, project_id")
        .eq("user_id", user.id)
        .order("scanned_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (errLatest) throw new Error(errLatest.message);
      if (latest) {
        data = latest as Row;
        const assets = (latest.assets as unknown[]) ?? [];
        console.log(
          `[scan-results] Found latest scan for user with ${assets.length} assets from date ${latest.scanned_at ?? "unknown"} (project_id=${latest.project_id ?? "null"})`
        );
      } else {
        console.log(`[scan-results] No scan found for user ${user.id}`);
      }
    }

    const assets = (data?.assets as unknown[]) ?? [];
    return NextResponse.json({
      success: true,
      assets,
      count: assets.length,
      scannedAt: data?.scanned_at ?? null,
      projectId: data?.project_id ?? projectId ?? null,
      matchedProjectId: matchedProject,
    });
  } catch (e) {
    console.error("[scan-results] Error:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
