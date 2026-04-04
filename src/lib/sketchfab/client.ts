const BASE_URL = "https://api.sketchfab.com/v3";

export interface SketchfabModel {
  uid: string;
  name: string;
  author: string;
  thumbnailUrl: string | null;
  vertexCount: number;
  faceCount: number;
  viewCount: number;
  license: string;
  url: string;
}

export async function searchModels(
  query: string,
  options: { count?: number; token?: string; sortBy?: string } = {}
): Promise<SketchfabModel[]> {
  const count = options.count ?? 12;
  const sort =
    options.sortBy !== undefined && options.sortBy !== ""
      ? `&sort_by=${encodeURIComponent(options.sortBy)}`
      : "";
  const url = `${BASE_URL}/search?type=models&q=${encodeURIComponent(query)}&downloadable=true&count=${count}${sort}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Token ${options.token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Sketchfab API error: ${res.status}`);
  const data = await res.json();

  return (data.results ?? []).map(
    (m: {
      uid: string;
      name: string;
      user?: { displayName?: string };
      thumbnails?: { images?: { url: string }[] };
      vertexCount?: number;
      faceCount?: number;
      viewCount?: number;
      license?: { label?: string };
    }) => ({
      uid: m.uid,
      name: m.name,
      author: m.user?.displayName ?? "Unknown",
      thumbnailUrl: m.thumbnails?.images?.[0]?.url ?? null,
      vertexCount: m.vertexCount ?? 0,
      faceCount: m.faceCount ?? 0,
      viewCount: m.viewCount ?? 0,
      license: m.license?.label ?? "Unknown",
      url: `https://sketchfab.com/3d-models/${m.uid}`,
    })
  );
}

export type SketchfabDownloadPick = {
  url: string;
  sizeBytes: number | null;
  fileNameHint: string;
};

/** Prefer source archive (often ZIP) when Sketchfab provides it, then GLB/GLTF. */
export async function getSketchfabDownloadPick(
  uid: string,
  token: string
): Promise<SketchfabDownloadPick | null> {
  const res = await fetch(`${BASE_URL}/models/${uid}/download`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  const source = data.source as { url?: string; size?: number } | undefined;
  const glb = data.glb as { url?: string; size?: number } | undefined;
  const gltf = data.gltf as { url?: string; size?: number } | undefined;

  let url: string | null = null;
  let sizeBytes: number | null = null;
  let ext = "bin";

  if (source?.url) {
    url = source.url;
    sizeBytes = typeof source.size === "number" ? source.size : null;
    const p = url.split("?")[0].toLowerCase();
    if (p.endsWith(".zip")) ext = "zip";
    else if (p.endsWith(".glb")) ext = "glb";
  } else if (glb?.url) {
    url = glb.url;
    sizeBytes = typeof glb.size === "number" ? glb.size : null;
    ext = "glb";
  } else if (gltf?.url) {
    url = gltf.url;
    sizeBytes = typeof gltf.size === "number" ? gltf.size : null;
    ext = "gltf";
  }

  if (!url) return null;
  return { url, sizeBytes, fileNameHint: `${uid}.${ext}` };
}

export async function getDownloadUrl(uid: string, token: string): Promise<string | null> {
  const pick = await getSketchfabDownloadPick(uid, token);
  return pick?.url ?? null;
}
