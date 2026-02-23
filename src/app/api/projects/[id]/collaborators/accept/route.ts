import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await req.json();
    const { userEmail } = body as { userEmail?: string };
    if (!projectId || !userEmail?.trim()) {
      return NextResponse.json(
        { error: "projectId and userEmail required" },
        { status: 400 }
      );
    }
    const supabase = createServerClient();
    const { error } = await supabase
      .from("project_collaborators")
      .update({
        status: "accepted",
        joined_at: new Date().toISOString(),
      })
      .eq("project_id", projectId)
      .eq("user_email", userEmail.trim());
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[project/collaborators/accept] POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
