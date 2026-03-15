import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import { checkUsageLimit } from "@/lib/usage/usageTracker";

export async function GET() {
  try {
    const supabase = await createServerAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const [ai, poly, sketch] = await Promise.all([
      checkUsageLimit(userId, "ai_message"),
      checkUsageLimit(userId, "polyhaven_import"),
      checkUsageLimit(userId, "sketchfab_import"),
    ]);

    return NextResponse.json({
      plan: ai.plan,
      ai_message: { used: ai.used, limit: ai.limit },
      polyhaven_import: { used: poly.used, limit: poly.limit },
      sketchfab_import: { used: sketch.used, limit: sketch.limit },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
