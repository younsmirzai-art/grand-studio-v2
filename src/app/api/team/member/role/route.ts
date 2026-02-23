import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { teamId, userEmail, newRole, updatedByEmail } = body as {
      teamId?: string;
      userEmail?: string;
      newRole?: string;
      updatedByEmail?: string;
    };
    if (!teamId || !userEmail?.trim() || !newRole) {
      return NextResponse.json(
        { error: "teamId, userEmail, newRole required" },
        { status: 400 }
      );
    }
    const validRoles = ["owner", "editor", "member", "viewer"];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    const supabase = createServerClient();

    const { data: team } = await supabase
      .from("teams")
      .select("owner_email")
      .eq("id", teamId)
      .single();
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    if (team.owner_email !== (updatedByEmail ?? "").trim()) {
      return NextResponse.json(
        { error: "Only owner can change roles" },
        { status: 403 }
      );
    }
    if (newRole === "owner") {
      return NextResponse.json(
        { error: "Use a separate transfer-ownership flow" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("team_members")
      .update({ role: newRole })
      .eq("team_id", teamId)
      .eq("user_email", userEmail.trim());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[team/member/role] PUT error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
