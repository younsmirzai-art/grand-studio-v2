import { NextRequest, NextResponse } from "next/server";
import {
  browseCatalog,
  parseBrowseSort,
  parseCatalogKind,
} from "@/lib/catalog/browse";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const limit = Number.parseInt(searchParams.get("limit") || "48", 10);
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
  const sort = parseBrowseSort(searchParams.get("sort"));
  const kind = parseCatalogKind(searchParams.get("type"));

  try {
    const result = await browseCatalog({
      q,
      categories,
      sources,
      licenses,
      kind,
      sort,
      limit: Number.isFinite(limit) ? limit : 48,
      offset: Number.isFinite(offset) ? offset : 0,
    });

    return NextResponse.json({
      models: result.models,
      total: result.total,
      hasMore: result.hasMore,
      offset: Number.isFinite(offset) ? offset : 0,
      limit: Number.isFinite(limit) ? limit : 48,
      sort,
      kind,
    });
  } catch (error) {
    console.error("Browse API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch models", models: [], total: 0, hasMore: false },
      { status: 500 }
    );
  }
}
