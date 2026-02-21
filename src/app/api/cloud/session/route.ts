import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSubscription, getMonthlyMinutesLimit } from "@/lib/cloud/subscription";
import { getMonthlyMinutesUsed } from "@/lib/cloud/usage";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, userEmail, gpuType, region } = body as {
      projectId?: string;
      userEmail?: string;
      gpuType?: string;
      region?: string;
    };

    if (!userEmail?.trim()) {
      return NextResponse.json({ error: "userEmail is required" }, { status: 400 });
    }

    const sub = await getSubscription(userEmail.trim());
    if (!sub || sub.tier === "starter") {
      return NextResponse.json(
        { error: "Cloud UE5 requires Pro plan or higher" },
        { status: 403 }
      );
    }

    const minutesUsed = await getMonthlyMinutesUsed(userEmail.trim());
    const limit = getMonthlyMinutesLimit(sub.tier);
    if (minutesUsed >= limit) {
      return NextResponse.json(
        { error: "Monthly cloud minutes exhausted. Upgrade your plan." },
        { status: 429 }
      );
    }

    const startedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const supabase = createServerClient();
    const { data: session, error } = await supabase
      .from("cloud_sessions")
      .insert({
        user_email: userEmail.trim(),
        project_id: projectId ?? null,
        status: "starting",
        provider: "cloud",
        gpu_type: gpuType || "t4",
        region: region || "auto",
        started_at: startedAt,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error("[cloud/session] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      sessionId: session.id,
      status: "starting",
      message:
        "Cloud UE5 is coming soon! For now, use Local mode with relay.py.",
      setupGuide: "/docs/local-setup",
    });
  } catch (e) {
    console.error("[cloud/session] POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const sessionId = new URL(req.url).searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("cloud_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Session not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("[cloud/session] GET error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { sessionId } = body as { sessionId?: string };
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: session, error: fetchError } = await supabase
      .from("cloud_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json(
        { error: fetchError?.message ?? "Session not found" },
        { status: 404 }
      );
    }

    const startedAt = session.started_at
      ? new Date(session.started_at).getTime()
      : Date.now();
    const minutes = Math.ceil((Date.now() - startedAt) / 60000);

    await supabase
      .from("cloud_sessions")
      .update({ status: "ended", total_minutes_used: minutes })
      .eq("id", sessionId);

    await supabase.from("cloud_usage").insert({
      user_email: session.user_email,
      session_id: sessionId,
      minutes_used: minutes,
    });

    return NextResponse.json({ status: "ended", minutesUsed: minutes });
  } catch (e) {
    console.error("[cloud/session] DELETE error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
