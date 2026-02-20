import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { projectId, code } = await request.json();

    if (!projectId || !code) {
      return NextResponse.json(
        { error: "Missing projectId or code" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("ue5_commands")
      .insert({
        project_id: projectId,
        code,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "execution",
      agent_name: "System",
      detail: `UE5 command queued: ${code.slice(0, 100)}`,
    });

    return NextResponse.json({ commandId: data.id });
  } catch (error) {
    console.error("UE5 execute error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
