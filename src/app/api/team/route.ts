import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const userEmail = new URL(req.url).searchParams.get("userEmail");
    if (!userEmail?.trim()) {
      return NextResponse.json({ error: "userEmail required" }, { status: 400 });
    }
    const supabase = createServerClient();

    const { data: owned } = await supabase
      .from("teams")
      .select("*")
      .eq("owner_email", userEmail.trim())
      .maybeSingle();

    if (owned) {
      const { data: allMembers } = await supabase
        .from("team_members")
        .select("*")
        .eq("team_id", owned.id)
        .order("joined_at", { ascending: true });
      const members = (allMembers ?? []).filter((m: { status?: string }) => m.status !== "pending");
      const pendingInvites = (allMembers ?? []).filter((m: { status?: string }) => m.status === "pending");
      return NextResponse.json({
        team: owned,
        members,
        pendingInvites,
        role: "owner",
      });
    }

    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_email", userEmail.trim())
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ team: null, members: [], role: null });
    }

    const { data: team } = await supabase
      .from("teams")
      .select("*")
      .eq("id", membership.team_id)
      .single();
    if (!team) {
      return NextResponse.json({ team: null, members: [], role: null });
    }

    const { data: allMembers } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", team.id)
      .order("joined_at", { ascending: true });
    const members = (allMembers ?? []).filter((m: { status?: string }) => m.status !== "pending");
    const pendingInvites = (allMembers ?? []).filter((m: { status?: string }) => m.status === "pending");

    return NextResponse.json({
      team,
      members,
      pendingInvites: membership.role === "owner" ? pendingInvites : [],
      role: membership.role,
    });
  } catch (e) {
    console.error("[team] GET error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, ownerEmail } = body as { name?: string; ownerEmail?: string };
    if (!ownerEmail?.trim() || !name?.trim()) {
      return NextResponse.json(
        { error: "name and ownerEmail required" },
        { status: 400 }
      );
    }
    const supabase = createServerClient();

    const { data: existing } = await supabase
      .from("teams")
      .select("id")
      .eq("owner_email", ownerEmail.trim())
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "You already have a team" },
        { status: 409 }
      );
    }

    const { data: team, error } = await supabase
      .from("teams")
      .insert({
        name: name.trim(),
        owner_email: ownerEmail.trim(),
        max_members: 5,
        plan: "free",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("team_members").insert({
      team_id: team.id,
      user_email: ownerEmail.trim(),
      display_name: ownerEmail.split("@")[0],
      role: "owner",
    });

    return NextResponse.json({ team });
  } catch (e) {
    console.error("[team] POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { teamId, name, userEmail } = body as { teamId?: string; name?: string; userEmail?: string };
    if (!teamId || !name?.trim() || !userEmail?.trim()) {
      return NextResponse.json(
        { error: "teamId, name, userEmail required" },
        { status: 400 }
      );
    }
    const supabase = createServerClient();
    const { data: team } = await supabase
      .from("teams")
      .select("owner_email")
      .eq("id", teamId)
      .single();
    if (!team || team.owner_email !== userEmail.trim()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { error } = await supabase
      .from("teams")
      .update({ name: name.trim() })
      .eq("id", teamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[team] PATCH error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
