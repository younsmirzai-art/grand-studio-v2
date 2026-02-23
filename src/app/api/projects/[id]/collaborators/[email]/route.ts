import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; email: string }> }
) {
  try {
    const { id: projectId, email } = await params;
    const decodedEmail = decodeURIComponent(email);
    if (!projectId || !decodedEmail) {
      return NextResponse.json({ error: "Project ID and email required" }, { status: 400 });
    }
    const supabase = createServerClient();
    const { error } = await supabase
      .from("project_collaborators")
      .delete()
      .eq("project_id", projectId)
      .eq("user_email", decodedEmail);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[project/collaborators/email] DELETE error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
