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

export async function getDownloadUrl(
  uid: string,
  token: string
): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/models/${uid}/download`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.glb?.url ?? null;
}
