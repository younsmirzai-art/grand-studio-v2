import { NextRequest, NextResponse } from "next/server";
import {
  getPolyHavenAssetsExtended,
  type BrowseSort,
} from "@/lib/polyhaven/client";

const SORTS: BrowseSort[] = ["newest", "popular", "downloads", "name"];

function parseSort(value: string | null): BrowseSort {
  if (value && (SORTS as string[]).includes(value)) {
    return value as BrowseSort;
  }
  return "popular";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const limit = Number.parseInt(searchParams.get("limit") || "24", 10);
  const offset = Number.parseInt(searchParams.get("offset") || "0", 10);
  const q = searchParams.get("q") || undefined;
  const categoriesStr = searchParams.get("categories");
  const sourcesStr = searchParams.get("sources");
  const licensesStr = searchParams.get("licenses");
  const categories = categoriesStr
    ? categoriesStr.split(",").filter(Boolean)
    : undefined;
  const sources = sourcesStr ? sourcesStr.split(",").filter(Boolean) : undefined;
  const licenses = licensesStr
    ? licensesStr.split(",").filter(Boolean)
    : undefined;
  const sort = parseSort(searchParams.get("sort"));

  try {
    const result = await getPolyHavenAssetsExtended({
      type: "models",
      search: q,
      categories,
      sources,
      licenses,
      limit: Number.isFinite(limit) ? limit : 24,
      offset: Number.isFinite(offset) ? offset : 0,
      sort,
    });

    return NextResponse.json({
      models: result.models,
      total: result.total,
      offset: Number.isFinite(offset) ? offset : 0,
      limit: Number.isFinite(limit) ? limit : 24,
      sort,
    });
  } catch (error) {
    console.error("Browse API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch models", models: [], total: 0 },
      { status: 500 }
    );
  }
}
