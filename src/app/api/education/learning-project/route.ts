import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** Get or create a single "Learning" project for the user (used by lesson page for UE5 viewport and execute). */
export async function GET(req: Request) {
  try {
    const userEmail = new URL(req.url).searchParams.get("userEmail");
    if (!userEmail?.trim()) {
      return NextResponse.json({ error: "userEmail required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .ilike("name", "Learning%")
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ projectId: (existing as { id: string }).id });
    }

    const { data: created, error } = await supabase
      .from("projects")
      .insert({
        name: "Learning",
        initial_prompt: "Used for Grand Studio Academy lessons.",
        status: "active",
      })
      .select("id")
      .single();

    if (error || !created) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create learning project" },
        { status: 500 }
      );
    }
    return NextResponse.json({ projectId: (created as { id: string }).id });
  } catch (e) {
    console.error("[education/learning-project] GET error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
