import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }
    const supabase = createServerClient();
    const { data } = await supabase
      .from("project_collaborators")
      .select("id, user_email, display_name, permission, status, invited_at, joined_at")
      .eq("project_id", projectId)
      .order("invited_at", { ascending: true });
    return NextResponse.json({ collaborators: data ?? [] });
  } catch (e) {
    console.error("[project/collaborators] GET error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await req.json();
    const { userEmail, displayName, permission, invitedBy } = body as {
      userEmail?: string;
      displayName?: string;
      permission?: string;
      invitedBy?: string;
    };
    if (!projectId || !userEmail?.trim() || !invitedBy?.trim()) {
      return NextResponse.json(
        { error: "projectId, userEmail, invitedBy required" },
        { status: 400 }
      );
    }
    const perm = permission === "owner" || permission === "editor" || permission === "viewer" ? permission : "edit";
    const supabase = createServerClient();
    const { error } = await supabase.from("project_collaborators").upsert(
      {
        project_id: projectId,
        user_email: userEmail.trim().toLowerCase(),
        display_name: displayName?.trim() || userEmail.split("@")[0],
        permission: perm === "edit" ? "editor" : perm,
        invited_by: invitedBy.trim(),
        status: "pending",
      },
      { onConflict: "project_id,user_email" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[project/collaborators] POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
