import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/tools/pixel-streaming-test
 * Body: { url: string } (e.g. ws://localhost:8888)
 * Tries to fetch the HTTP version of the URL (player page). Works when app and UE5 run on same machine.
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ connected: false, error: "Missing url" }, { status: 400 });
    }
    const httpUrl = url.trim().replace(/^ws:/i, "http:");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(httpUrl, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeout);
    const connected = res != null && res.ok;
    return NextResponse.json({ connected });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
