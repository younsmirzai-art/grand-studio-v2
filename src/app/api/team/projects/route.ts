import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** GET shared projects for a user: projects where they are a collaborator or we list by project_collaborators. */
export async function GET(req: Request) {
  try {
    const userEmail = new URL(req.url).searchParams.get("userEmail");
    if (!userEmail?.trim()) {
      return NextResponse.json({ error: "userEmail required" }, { status: 400 });
    }
    const supabase = createServerClient();

    const { data: rows } = await supabase
      .from("project_collaborators")
      .select("project_id, display_name, permission, user_email, status")
      .eq("user_email", userEmail.trim())
      .not("joined_at", "is", null);

    const projectIds = [...new Set((rows ?? []).map((r: { project_id: string }) => r.project_id).filter(Boolean))];
    if (projectIds.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, updated_at")
      .in("id", projectIds);

    const { data: allCollabs } = await supabase
      .from("project_collaborators")
      .select("project_id, user_email, display_name, permission, status")
      .in("project_id", projectIds)
      .eq("status", "accepted");

    const collabsByProject = (allCollabs ?? []).reduce((acc: Record<string, { user_email: string; display_name: string | null; permission: string }[]>, r: { project_id: string; user_email: string; display_name: string | null; permission: string }) => {
      if (!acc[r.project_id]) acc[r.project_id] = [];
      acc[r.project_id].push({
        user_email: r.user_email,
        display_name: r.display_name,
        permission: r.permission,
      });
      return acc;
    }, {});

    const result = (projects ?? []).map((p: { id: string; name: string; updated_at: string }) => ({
      id: p.id,
      name: p.name,
      updated_at: p.updated_at,
      collaborators: collabsByProject[p.id] ?? [],
    }));

    return NextResponse.json({ projects: result });
  } catch (e) {
    console.error("[team/projects] GET error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
