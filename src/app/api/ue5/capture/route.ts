import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

const MSG =
  "Viewport capture through the website relay is no longer available. Capture from Unreal Editor or use the Grand Studio Commander plugin.";

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    return NextResponse.json({ error: MSG, code: "RELAY_REMOVED" }, { status: 503 });
  } catch (err) {
    console.error("[ue5/capture]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Capture unavailable" },
      { status: 500 }
    );
  }
}
