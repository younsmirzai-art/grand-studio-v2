import { NextRequest, NextResponse } from "next/server";
import { handleBossCommand } from "@/lib/agents/orchestrator";

export async function POST(request: NextRequest) {
  console.log("=== /api/agents/run called ===");
  console.log("OPENROUTER_API_KEY exists:", !!process.env.OPENROUTER_API_KEY);
  console.log("NEXT_PUBLIC_SUPABASE_URL exists:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await request.json();
    console.log("Request body:", JSON.stringify(body));

    const { projectId, bossMessage } = body;

    if (!projectId || !bossMessage) {
      console.log("Missing fields - projectId:", !!projectId, "bossMessage:", !!bossMessage);
      return NextResponse.json(
        { error: "Missing projectId or bossMessage" },
        { status: 400 }
      );
    }

    console.log("Calling handleBossCommand for project:", projectId);
    await handleBossCommand(projectId, bossMessage);
    console.log("handleBossCommand completed successfully");

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("=== /api/agents/run ERROR ===");
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    console.error("Full error:", error);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}
