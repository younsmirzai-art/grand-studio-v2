export type CatalogSource = "polyhaven" | "sketchfab" | "ambientcg";

export const SKETCHFAB_ID_PREFIX = "sf-";
export const AMBIENTCG_ID_PREFIX = "acg-";

export function toSketchfabCatalogId(uid: string): string {
  return `${SKETCHFAB_ID_PREFIX}${uid}`;
}

export function toAmbientCgCatalogId(assetId: string): string {
  return `${AMBIENTCG_ID_PREFIX}${assetId}`;
}

export function parseCatalogId(raw: string): {
  source: CatalogSource;
  id: string;
} {
  if (raw.startsWith(SKETCHFAB_ID_PREFIX)) {
    return { source: "sketchfab", id: raw.slice(SKETCHFAB_ID_PREFIX.length) };
  }
  if (raw.startsWith(AMBIENTCG_ID_PREFIX)) {
    return { source: "ambientcg", id: raw.slice(AMBIENTCG_ID_PREFIX.length) };
  }
  return { source: "polyhaven", id: raw };
}
