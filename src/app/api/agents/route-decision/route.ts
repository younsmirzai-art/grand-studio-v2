import { NextRequest, NextResponse } from "next/server";
import { runRouteDecision } from "@/lib/agents/orchestrator";

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId" },
        { status: 400 }
      );
    }

    await runRouteDecision(projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Route decision error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
