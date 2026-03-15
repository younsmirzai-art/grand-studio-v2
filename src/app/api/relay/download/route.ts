import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const relayPath = join(process.cwd(), "ue5-relay", "relay.py");
    if (!existsSync(relayPath)) {
      return NextResponse.json(
        { error: "relay.py not found" },
        { status: 404 }
      );
    }
    const body = readFileSync(relayPath, "utf-8");
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/x-python; charset=utf-8",
        "Content-Disposition": 'attachment; filename="relay.py"',
      },
    });
  } catch (err) {
    console.error("[relay/download]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Download failed" },
      { status: 500 }
    );
  }
}
