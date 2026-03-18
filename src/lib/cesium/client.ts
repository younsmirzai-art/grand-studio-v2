/**
 * World Explorer geocoding (server-side).
 * Uses Nominatim OpenStreetMap API (no key required).
 */

export async function getCoordinates(locationName: string): Promise<{
  lat: number;
  lon: number;
  displayName: string;
}> {
  const q = locationName.trim();
  if (!q) throw new Error("locationName is required");

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: {
      // Nominatim policy requires a non-generic User-Agent/Referer
      "User-Agent": "GrandStudioWorldExplorer/1.0 (support@grandstudio.ai)",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
  const first = data?.[0];
  if (!first?.lat || !first?.lon) throw new Error("No results for location");
  return {
    lat: Number(first.lat),
    lon: Number(first.lon),
    displayName: first.display_name ?? q,
  };
}

