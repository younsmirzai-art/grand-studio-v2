import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";
import { checkUsageLimit } from "@/lib/usage/usageTracker";

const UPGRADE_MSG = "You can only have 2 projects on the Free plan. Upgrade to Pro for up to 10 projects!";

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const body = await request.json();
    const { name, initial_prompt } = body as { name?: string; initial_prompt?: string };
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const limitCheck = await checkUsageLimit(userId, "max_projects");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: UPGRADE_MSG, limitReached: true, used: limitCheck.used, limit: limitCheck.limit },
        { status: 403 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        initial_prompt: typeof initial_prompt === "string" ? initial_prompt.trim() : "",
        user_id: userId,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
