import { NextRequest, NextResponse } from "next/server";
import { handleBossCommand } from "@/lib/agents/orchestrator";

export async function POST(request: NextRequest) {
  try {
    const { projectId, bossMessage } = await request.json();

    if (!projectId || !bossMessage) {
      return NextResponse.json(
        { error: "Missing projectId or bossMessage" },
        { status: 400 }
      );
    }

    await handleBossCommand(projectId, bossMessage);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Agent run error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
