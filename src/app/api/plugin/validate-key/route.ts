import { NextRequest, NextResponse } from "next/server";
import {
  grandStudioApiKeyExistsInDatabase,
  isGrandStudioApiKeyFormat,
} from "@/lib/plugin/grandStudioApiKey";

/**
 * GET /api/plugin/validate-key
 * Header X-GrandStudio-Key or query ?key=
 */
export async function GET(request: NextRequest) {
  const header = request.headers.get("x-grandstudio-key")?.trim() ?? "";
  const query = request.nextUrl.searchParams.get("key")?.trim() ?? "";
  const apiKey = header || query;

  if (!apiKey) {
    return NextResponse.json({ valid: false, error: "Invalid API key" }, { status: 400 });
  }

  if (!isGrandStudioApiKeyFormat(apiKey)) {
    return NextResponse.json({ valid: false, error: "Invalid API key" });
  }

  const exists = await grandStudioApiKeyExistsInDatabase(apiKey);
  if (!exists) {
    return NextResponse.json({ valid: false, error: "Invalid API key" });
  }

  return NextResponse.json({ valid: true, plan: "free" });
}
