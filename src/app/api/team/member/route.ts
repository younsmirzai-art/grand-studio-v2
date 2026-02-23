import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { teamId, userEmail, removedByEmail } = body as {
      teamId?: string;
      userEmail?: string;
      removedByEmail?: string;
    };
    if (!teamId || !userEmail?.trim()) {
      return NextResponse.json(
        { error: "teamId and userEmail required" },
        { status: 400 }
      );
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
    const isOwner = team.owner_email === (removedByEmail ?? "").trim();
    const isSelf = userEmail.trim() === (removedByEmail ?? "").trim();
    if (!isOwner && !isSelf) {
      return NextResponse.json(
        { error: "Only owner can remove others; members can leave" },
        { status: 403 }
      );
    }
    if (team.owner_email === userEmail.trim()) {
      return NextResponse.json(
        { error: "Owner cannot be removed. Transfer ownership first." },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_email", userEmail.trim());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[team/member] DELETE error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
