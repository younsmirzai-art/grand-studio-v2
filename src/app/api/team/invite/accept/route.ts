import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { teamId, userEmail } = body as { teamId?: string; userEmail?: string };
    if (!teamId || !userEmail?.trim()) {
      return NextResponse.json(
        { error: "teamId and userEmail required" },
        { status: 400 }
      );
    }
    const supabase = createServerClient();

    const { data: member, error: fetchErr } = await supabase
      .from("team_members")
      .select("id, status")
      .eq("team_id", teamId)
      .eq("user_email", userEmail.trim())
      .single();

    if (fetchErr || !member) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    if (member.status !== "pending") {
      return NextResponse.json({ success: true, message: "Already a member" });
    }

    const { error } = await supabase
      .from("team_members")
      .update({
        status: "active",
        joined_at: new Date().toISOString(),
      })
      .eq("team_id", teamId)
      .eq("user_email", userEmail.trim());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[team/invite/accept] POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
