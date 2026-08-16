import {
  getAssets,
  searchAssets,
  type BrowseSort,
  type Model,
  type PolyHavenAsset,
  type PolyHavenAssetType,
} from "@/lib/polyhaven/client";
import {
  listAmbientCgAssets,
  ambientCgToModel,
} from "@/lib/ambientcg/client";
import {
  listSketchfabModels,
  sketchfabToModel,
  SKETCHFAB_DOWNLOADABLE_CAP,
} from "@/lib/sketchfab/client";

export type CatalogKind = "all" | "models" | "textures" | "hdris";

const SORTS: BrowseSort[] = ["newest", "popular", "downloads", "name"];

export function parseCatalogKind(value: string | null): CatalogKind {
  switch (value) {
    case "models":
    case "textures":
    case "hdris":
    case "all":
      return value;
    default:
      return "all";
  }
}

export function parseBrowseSort(value: string | null): BrowseSort {
  if (value && (SORTS as string[]).includes(value)) {
    return value as BrowseSort;
  }
  return "popular";
}

function sketchfabSort(sort: BrowseSort): string {
  switch (sort) {
    case "newest":
      return "-publishedAt";
    case "name":
      return "-likeCount";
    case "popular":
    case "downloads":
      return "-likeCount";
    default: {
      const _exhaustive: never = sort;
      void _exhaustive;
      return "-likeCount";
    }
  }
}

function sortPolyHaven(list: PolyHavenAsset[], sort: BrowseSort): PolyHavenAsset[] {
  const sorted = [...list];
  switch (sort) {
    case "newest":
      sorted.sort((a, b) => b.datePublished - a.datePublished);
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "popular":
    case "downloads":
      sorted.sort((a, b) => b.downloadCount - a.downloadCount);
      break;
    default: {
      const _exhaustive: never = sort;
      void _exhaustive;
      sorted.sort((a, b) => b.downloadCount - a.downloadCount);
    }
  }
  return sorted;
}

function assetToModel(asset: PolyHavenAsset): Model {
  const kind: Model["kind"] =
    asset.type === "textures"
      ? "texture"
      : asset.type === "hdris"
        ? "hdri"
        : "model";
  return {
    id: asset.id,
    name: asset.name,
    thumbnail: `https://cdn.polyhaven.com/asset_img/thumbs/${asset.id}.png?width=400`,
    source: "Poly Haven",
    downloads: asset.downloadCount,
    isFree: true,
    categories: asset.categories,
    tags: asset.tags,
    kind,
  };
}

async function loadPolyHaven(
  types: PolyHavenAssetType[],
  search: string | undefined,
  categories: string[],
  sort: BrowseSort
): Promise<Model[]> {
  const batches = await Promise.all(
    types.map(async (type) => {
      if (search?.trim()) {
        return searchAssets(search.trim(), type, 400);
      }
      return getAssets(type);
    })
  );
  let list = batches.flat();
  if (categories.length > 0) {
    list = list.filter((asset) =>
      categories.some((needle) => {
        const n = needle.toLowerCase().replace(/-/g, " ");
        return (
          asset.categories.some((c) => c.toLowerCase().includes(n.split(" ")[0] ?? n)) ||
          asset.tags.some((t) => t.toLowerCase().includes(n.split(" ")[0] ?? n)) ||
          asset.name.toLowerCase().includes(n.split(" ")[0] ?? n)
        );
      })
    );
  }
  return sortPolyHaven(list, sort).map(assetToModel);
}

function wantedSources(sources: string[] | undefined): {
  polyhaven: boolean;
  sketchfab: boolean;
  ambientcg: boolean;
} {
  if (!sources || sources.length === 0) {
    return { polyhaven: true, sketchfab: true, ambientcg: true };
  }
  return {
    polyhaven: sources.includes("polyhaven"),
    sketchfab: sources.includes("sketchfab"),
    ambientcg: sources.includes("ambientcg"),
  };
}

function polyHavenTypesFor(kind: CatalogKind): PolyHavenAssetType[] {
  switch (kind) {
    case "models":
      return ["models"];
    case "textures":
      return ["textures"];
    case "hdris":
      return ["hdris"];
    case "all":
      return ["models", "textures", "hdris"];
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return ["models", "textures", "hdris"];
    }
  }
}

async function loadSketchfabWindow(options: {
  query?: string;
  categories: string[];
  startCursor: number;
  want: number;
  sortBy: string;
  token?: string;
}): Promise<{ models: Awaited<ReturnType<typeof listSketchfabModels>>["models"]; nextCursor: number | null }> {
  const collected: Awaited<ReturnType<typeof listSketchfabModels>>["models"] = [];
  let cursor = options.startCursor;
  let nextCursor: number | null = cursor;
  while (
    collected.length < options.want &&
    nextCursor !== null &&
    cursor < SKETCHFAB_DOWNLOADABLE_CAP
  ) {
    const page = await listSketchfabModels({
      query: options.query,
      categories: options.categories,
      cursor,
      count: Math.min(24, options.want - collected.length),
      sortBy: options.sortBy,
      token: options.token,
    });
    collected.push(...page.models);
    nextCursor = page.nextCursor;
    if (nextCursor === null || page.models.length === 0) break;
    cursor = nextCursor;
  }
  return { models: collected.slice(0, options.want), nextCursor };
}

function applyLicenseFilter(
  wanted: ReturnType<typeof wantedSources>,
  licenses: string[] | undefined
): ReturnType<typeof wantedSources> {
  if (!licenses || licenses.length === 0) {
    return wanted;
  }

  const wantsCc0 = licenses.includes("cc0");
  const wantsCcBy = licenses.includes("cc-by");
  const wantsRf = licenses.includes("royalty-free");

  return {
    polyhaven: wanted.polyhaven && wantsCc0,
    ambientcg: wanted.ambientcg && wantsCc0,
    sketchfab: wanted.sketchfab && (wantsCcBy || wantsRf),
  };
}

export async function browseCatalog(options: {
  q?: string;
  categories?: string[];
  sources?: string[];
  licenses?: string[];
  kind?: CatalogKind;
  sort?: BrowseSort;
  offset?: number;
  limit?: number;
}): Promise<{ models: Model[]; total: number; hasMore: boolean }> {
  const kind = options.kind ?? "all";
  const sort = options.sort ?? "popular";
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.max(1, Math.min(48, options.limit ?? 48));
  const categories = options.categories ?? [];
  const wanted = applyLicenseFilter(
    wantedSources(options.sources),
    options.licenses
  );
  const pageIndex = Math.floor(offset / limit);
  const includeModels = kind === "all" || kind === "models";
  const includeTextures = kind === "all" || kind === "textures";
  const includeHdris = kind === "all" || kind === "hdris";

  const sketchfabCount =
    wanted.sketchfab && includeModels
      ? wanted.polyhaven || (wanted.ambientcg && kind !== "models")
        ? 24
        : limit
      : 0;
  const polyCount = wanted.polyhaven
    ? Math.max(8, limit - sketchfabCount - (wanted.ambientcg && kind !== "models" ? 12 : 0))
    : 0;
  const ambientCount =
    wanted.ambientcg && (includeTextures || includeHdris)
      ? Math.max(8, limit - sketchfabCount - Math.min(polyCount, 16))
      : 0;

  const token = process.env.SKETCHFAB_API_TOKEN?.trim();

  const polyTypes = polyHavenTypesFor(kind);

  const ambientType =
    kind === "hdris"
      ? "HDRI"
      : kind === "textures"
        ? "Material"
        : kind === "models"
          ? "3DModel"
          : "Material,HDRI";

  const [polyResult, ambientResult, sketchResult] = await Promise.allSettled([
    wanted.polyhaven && polyTypes.length > 0
      ? loadPolyHaven(polyTypes, options.q, categories, sort)
      : Promise.resolve([] as Model[]),
    wanted.ambientcg && ambientCount > 0 && kind !== "models"
      ? listAmbientCgAssets({
          query: options.q || categories[0],
          type: ambientType,
          offset: pageIndex * ambientCount,
          limit: ambientCount,
        })
      : Promise.resolve({ assets: [], total: 0 }),
    wanted.sketchfab && sketchfabCount > 0
      ? loadSketchfabWindow({
          query: options.q,
          categories,
          startCursor: pageIndex * sketchfabCount,
          want: sketchfabCount,
          sortBy: sketchfabSort(sort),
          token,
        })
      : Promise.resolve({ models: [], nextCursor: null }),
  ]);

  const polyModels =
    polyResult.status === "fulfilled" ? polyResult.value : [];
  const ambient =
    ambientResult.status === "fulfilled" ? ambientResult.value : { assets: [], total: 0 };
  const sketch =
    sketchResult.status === "fulfilled"
      ? sketchResult.value
      : { models: [], nextCursor: null };

  if (polyResult.status === "rejected") {
    console.error("[catalog] Poly Haven browse failed", polyResult.reason);
  }
  if (ambientResult.status === "rejected") {
    console.error("[catalog] ambientCG browse failed", ambientResult.reason);
  }
  if (sketchResult.status === "rejected") {
    console.error("[catalog] Sketchfab browse failed", sketchResult.reason);
  }

  const polySlice = polyModels.slice(
    pageIndex * Math.max(polyCount, 1),
    pageIndex * Math.max(polyCount, 1) + polyCount
  );
  const ambientModels = ambient.assets.map(ambientCgToModel);
  const sketchModels = sketch.models.map(sketchfabToModel);

  const models = [...sketchModels, ...polySlice, ...ambientModels];
  const seen = new Set<string>();
  const unique = models.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  const sketchTotal = wanted.sketchfab && includeModels ? SKETCHFAB_DOWNLOADABLE_CAP : 0;
  const polyTotal = wanted.polyhaven ? polyModels.length : 0;
  const ambientTotal = wanted.ambientcg ? ambient.total : 0;
  const total = sketchTotal + polyTotal + ambientTotal;

  const polyHasMore =
    pageIndex * Math.max(polyCount, 1) + polySlice.length < polyModels.length;
  const ambientHasMore =
    pageIndex * ambientCount + ambientModels.length < ambient.total;
  const sketchHasMore = sketch.nextCursor !== null;

  return {
    models: unique,
    total,
    hasMore: sketchHasMore || polyHasMore || ambientHasMore,
  };
}
