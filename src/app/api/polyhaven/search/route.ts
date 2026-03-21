import { NextRequest, NextResponse } from "next/server";
import { searchAssets, type PolyHavenAssetType } from "@/lib/polyhaven/client";

/** GET /api/polyhaven/search?q=tree&type=models&count=20 — convenience for debugging / agents. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? searchParams.get("query") ?? "";
    if (!query.trim()) {
      return NextResponse.json({ error: "q or query is required" }, { status: 400 });
    }
    const type = (searchParams.get("type") as PolyHavenAssetType | null) ?? "models";
    const count = Math.min(50, Math.max(1, Number(searchParams.get("count")) || 20));
    const results = await searchAssets(query, type, count);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[polyhaven/search GET] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, type, count } = body as {
      query: string;
      type?: PolyHavenAssetType;
      count?: number;
    };

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const assetType: PolyHavenAssetType = type ?? "models";
    const results = await searchAssets(query, assetType, count ?? 20);

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[polyhaven/search] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}
