import { NextRequest, NextResponse } from "next/server";
import { runNextTurn } from "@/lib/agents/orchestrator";

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId" },
        { status: 400 }
      );
    }

    const result = await runNextTurn(projectId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Autonomous cycle error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
