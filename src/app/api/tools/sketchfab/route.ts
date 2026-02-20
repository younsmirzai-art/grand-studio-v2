import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "car";

  try {
    const url = `https://api.sketchfab.com/v3/search?type=models&q=${encodeURIComponent(q)}&downloadable=true&count=24`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Sketchfab API error: ${res.status}`);
    }

    const data = await res.json();
    const results = (data.results ?? []).map((m: { name: string; user: { displayName: string }; thumbnails: { images: { url: string }[] }; viewCount: number; uid: string }) => ({
      id: m.uid,
      name: m.name,
      author: m.user?.displayName ?? "Unknown",
      thumbnail: m.thumbnails?.images?.[0]?.url ?? null,
      viewCount: m.viewCount ?? 0,
      url: `https://sketchfab.com/3d-models/${m.uid}`,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[sketchfab] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}
