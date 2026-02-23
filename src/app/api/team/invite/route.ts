import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { teamId, inviterEmail, inviteeEmail, role, displayName } = body as {
      teamId?: string;
      inviterEmail?: string;
      inviteeEmail?: string;
      role?: string;
      displayName?: string;
    };
    if (!teamId || !inviterEmail?.trim() || !inviteeEmail?.trim()) {
      return NextResponse.json(
        { error: "teamId, inviterEmail, inviteeEmail required" },
        { status: 400 }
      );
    }
    const supabase = createServerClient();

    const { data: team } = await supabase
      .from("teams")
      .select("id, owner_email, max_members")
      .eq("id", teamId)
      .single();
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    const isOwner = team.owner_email === inviterEmail.trim();
    const { data: inviterMember } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_email", inviterEmail.trim())
      .maybeSingle();
    if (!isOwner && inviterMember?.role !== "editor") {
      return NextResponse.json({ error: "Only owner or editors can invite" }, { status: 403 });
    }

    const { count } = await supabase
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId);
    if ((count ?? 0) >= (team.max_members ?? 5)) {
      return NextResponse.json({ error: "Team is full" }, { status: 409 });
    }

    const { error } = await supabase.from("team_members").upsert(
      {
        team_id: teamId,
        user_email: inviteeEmail.trim().toLowerCase(),
        display_name: displayName?.trim() || inviteeEmail.split("@")[0],
        role: role || "member",
        status: "pending",
        invited_by: inviterEmail.trim(),
      },
      { onConflict: "team_id,user_email" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Invite sent" });
  } catch (e) {
    console.error("[team/invite] POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
