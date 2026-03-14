import { NextResponse } from "next/server";

const API_URL = "https://api.sketchfab.com/v3/search?type=models&q=rock&downloadable=true&count=5";

export async function GET() {
  const token = process.env.SKETCHFAB_API_TOKEN;
  console.log("[TEST SKETCHFAB] Step 1: SKETCHFAB_API_TOKEN present?", !!token);

  if (!token) {
    console.error("[TEST SKETCHFAB] Missing SKETCHFAB_API_TOKEN");
    return NextResponse.json(
      { success: false, error: "SKETCHFAB_API_TOKEN is not set. Add it to your .env.local" },
      { status: 500 }
    );
  }

  console.log("[TEST SKETCHFAB] Step 2: Fetching", API_URL);
  try {
    const res = await fetch(API_URL, {
      headers: {
        Accept: "application/json",
        Authorization: `Token ${token}`,
      },
      cache: "no-store",
    });
    console.log("[TEST SKETCHFAB] Step 3: Response status", res.status, res.statusText);

    const data = await res.json();
    console.log("[TEST SKETCHFAB] Step 4: Response keys", data && typeof data === "object" ? Object.keys(data) : "n/a");

    const results = data?.results ?? [];
    const count = Array.isArray(results) ? results.length : 0;
    console.log("[TEST SKETCHFAB] Step 5: Number of results", count);

    const firstThree = (results as { uid?: string; name?: string }[]).slice(0, 3).map((m) => ({
      uid: m.uid,
      name: m.name,
    }));
    firstThree.forEach((m, i) => console.log("[TEST SKETCHFAB] Result", i + 1, m.uid, m.name));

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      resultCount: count,
      firstThree,
      fullResponse: data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[TEST SKETCHFAB] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
