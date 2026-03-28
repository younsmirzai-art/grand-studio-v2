import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/plugin/validate-key
 * Query: ?key=... or header X-GrandStudio-Key
 * Placeholder: any non-empty key is valid until Supabase validation exists.
 */
export async function GET(request: NextRequest) {
  const header = request.headers.get("x-grandstudio-key")?.trim() ?? "";
  const query = request.nextUrl.searchParams.get("key")?.trim() ?? "";
  const apiKey = header || query;
  if (!apiKey) {
    return NextResponse.json(
      { valid: false, error: "API key required. Get your key at https://grandstudio.dev/dashboard" },
      { status: 400 },
    );
  }
  return NextResponse.json({ valid: true, plan: "free" });
}
