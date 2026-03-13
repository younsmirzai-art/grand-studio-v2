import { NextRequest, NextResponse } from "next/server";
import { searchModels } from "@/lib/sketchfab/client";

export async function POST(request: NextRequest) {
  try {
    const { query, count } = (await request.json()) as {
      query: string;
      count?: number;
    };

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const token = process.env.SKETCHFAB_API_TOKEN;
    const results = await searchModels(query, { count: count ?? 12, token: token ?? undefined });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[sketchfab/search] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}
