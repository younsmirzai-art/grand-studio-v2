import { NextResponse } from "next/server";

const API_URL = "https://api.polyhaven.com/assets?t=models";
const USER_AGENT = "GrandStudio/1.0 (contact@grandstudio.dev)";

export async function GET() {
  console.log("[TEST POLYHAVEN] Step 1: Fetching", API_URL);
  try {
    const res = await fetch(API_URL, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    });
    console.log("[TEST POLYHAVEN] Step 2: Response status", res.status, res.statusText);

    const data = await res.json();
    console.log("[TEST POLYHAVEN] Step 3: Response type", typeof data);
    console.log("[TEST POLYHAVEN] Step 4: Is array?", Array.isArray(data));
    console.log("[TEST POLYHAVEN] Step 5: Keys (first 20)", data && typeof data === "object" ? Object.keys(data).slice(0, 20) : "n/a");

    const isObject = data && typeof data === "object" && !Array.isArray(data);
    const keys = isObject ? Object.keys(data) : [];
    const count = keys.length;
    console.log("[TEST POLYHAVEN] Step 6: Number of asset IDs (keys)", count);

    const firstThreeNames = keys.slice(0, 3).map((id: string) => {
      const asset = data[id];
      const name = asset?.name ?? id;
      console.log("[TEST POLYHAVEN] Asset", id, "-> name:", name);
      return { id, name };
    });

    return NextResponse.json({
      success: true,
      status: res.status,
      responseType: Array.isArray(data) ? "array" : "object",
      assetCount: count,
      firstThreeNames,
      sampleKeys: keys.slice(0, 10),
      rawSample: keys.length > 0
        ? { [keys[0]]: data[keys[0]] }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[TEST POLYHAVEN] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
