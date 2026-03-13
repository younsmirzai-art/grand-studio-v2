import { NextRequest, NextResponse } from "next/server";
import { searchAssets, type PolyHavenAssetType } from "@/lib/polyhaven/client";

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
