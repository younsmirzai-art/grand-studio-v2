import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";

/**
 * Legacy relay test — remote queue removed.
 * GET /api/test/place-test?projectId=...
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await createServerAuthClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";
    if (!projectId) {
      return NextResponse.json({ error: "projectId query parameter required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: project, error } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Placement test queue was part of the removed relay. Run placement scripts from the Commander plugin.",
        code: "RELAY_REMOVED",
      },
      { status: 410 }
    );
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
