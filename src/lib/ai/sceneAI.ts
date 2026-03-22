import type { SceneRequest, SceneObject } from "@/lib/ai/sceneSchema";

type ScannedAsset = { path?: string; name?: string; type?: string };

const DEFAULT_MODEL = "anthropic/claude-3-5-sonnet-20241022";

const SCENE_JSON_SYSTEM = `You are a scene description AI. You receive a user request and output ONLY a valid JSON object matching this structure:

{
  "scene_type": "village" | "city" | "forest" | "beach" | "desert" | "mountain" | "park" | "military" | "medieval" | "modern" | "custom",
  "terrain": "flat_grass" | "hills" | "mountain" | "island" | "desert_sand" | "snow" | "beach_sand" | "forest_floor" | "urban_flat" | "none",
  "buildings": [ { "type": string, "count": number, "style"?: string, "size"?: "small"|"medium"|"large" } ],
  "vegetation": [ SceneObject ],
  "vehicles": [ SceneObject ],
  "infrastructure": [ SceneObject ],
  "details": [ SceneObject ],
  "characters": [ SceneObject ],
  "layout": "grid" | "circle" | "random" | "along_road" | "clustered" | "scattered",
  "lighting": "daytime" | "sunset" | "night" | "overcast" | "dawn",
  "scale": "small" | "medium" | "large"
}

Rules:
- Do not write any text before or after the JSON. Do not write Python. Do not explain.
- For a village: include 5-10 buildings, 10-15 trees, 2-5 vehicles, 5-10 street lights, 3-5 benches or details
- For a city: include 10-20 buildings, 5-10 trees, 5-10 vehicles, 10-20 street lights, 5-10 details
- For a forest: include 0-2 buildings (cabin), 20-40 trees, 0 vehicles, 0-5 details like rocks
- For a beach: include 2-5 buildings, 5-10 palm trees, 1-3 boats, 3-5 beach items
- For a desert: include 2-5 buildings, 3-5 cacti, 1-2 vehicles, 2-5 rocks
- Always include enough objects for a FULL scene
- Match styles: village=cottage/farmhouse, city=skyscraper/office, medieval=castle/tavern
- Match vegetation: beach=palm, forest=pine/oak, desert=cactus
- count must be at least 1 for every object in every array
- scale: small=~30m area, medium=~60m, large=~100m (descriptive only; engine uses this for bounds)
- Use type strings our engine understands: house, building, skyscraper, shop, tree, pine, palm, cactus, car, truck, boat, street_light, bench, rock, barrel, fence, wall, etc.`;

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    const last = trimmed.lastIndexOf("}");
    if (last > 0) return trimmed.slice(0, last + 1);
  }
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : null;
}

function normalizeSceneObject(o: unknown): SceneObject | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const type = typeof r.type === "string" ? r.type.trim() : "";
  const count = Number(r.count);
  if (!type || !Number.isFinite(count) || count < 1) return null;
  const style = typeof r.style === "string" ? r.style : undefined;
  const size = r.size === "small" || r.size === "medium" || r.size === "large" ? r.size : undefined;
  return { type, count: Math.min(50, Math.floor(count)), style, size };
}

const SCENE_TYPES = new Set<string>([
  "village",
  "city",
  "forest",
  "beach",
  "desert",
  "mountain",
  "park",
  "military",
  "medieval",
  "modern",
  "custom",
]);
const TERRAIN_TYPES = new Set<string>([
  "flat_grass",
  "hills",
  "mountain",
  "island",
  "desert_sand",
  "snow",
  "beach_sand",
  "forest_floor",
  "urban_flat",
  "none",
]);
const LAYOUT_TYPES = new Set<string>(["grid", "circle", "random", "along_road", "clustered", "scattered"]);
const LIGHTING_TYPES = new Set<string>(["daytime", "sunset", "night", "overcast", "dawn"]);
const SCALE_TYPES = new Set<string>(["small", "medium", "large"]);

function normalizeSceneRequest(raw: Record<string, unknown>): SceneRequest {
  const arr = (k: string) => {
    const v = raw[k];
    if (!Array.isArray(v)) return [];
    return v.map(normalizeSceneObject).filter(Boolean) as SceneObject[];
  };

  const st = raw.scene_type;
  const scene_type: SceneRequest["scene_type"] =
    typeof st === "string" && SCENE_TYPES.has(st) ? (st as SceneRequest["scene_type"]) : "custom";

  const tr = raw.terrain;
  const terrain: SceneRequest["terrain"] =
    typeof tr === "string" && TERRAIN_TYPES.has(tr) ? (tr as SceneRequest["terrain"]) : "flat_grass";

  const lo = raw.layout;
  const layout: SceneRequest["layout"] =
    typeof lo === "string" && LAYOUT_TYPES.has(lo) ? (lo as SceneRequest["layout"]) : "grid";

  const li = raw.lighting;
  const lighting: SceneRequest["lighting"] =
    typeof li === "string" && LIGHTING_TYPES.has(li) ? (li as SceneRequest["lighting"]) : "daytime";

  const sc = raw.scale;
  const scale: SceneRequest["scale"] =
    typeof sc === "string" && SCALE_TYPES.has(sc) ? (sc as SceneRequest["scale"]) : "medium";

  return {
    scene_type: scene_type,
    terrain,
    buildings: arr("buildings"),
    vegetation: arr("vegetation"),
    vehicles: arr("vehicles"),
    infrastructure: arr("infrastructure"),
    details: arr("details"),
    characters: arr("characters"),
    layout,
    lighting,
    scale,
  };
}

export function defaultSceneFromKeywords(userPrompt: string): SceneRequest {
  const p = userPrompt.toLowerCase();
  const base = (partial: Partial<SceneRequest>): SceneRequest => ({
    scene_type: partial.scene_type ?? "custom",
    terrain: partial.terrain ?? "flat_grass",
    buildings: partial.buildings ?? [],
    vegetation: partial.vegetation ?? [],
    vehicles: partial.vehicles ?? [],
    infrastructure: partial.infrastructure ?? [],
    details: partial.details ?? [],
    characters: partial.characters ?? [],
    layout: partial.layout ?? "grid",
    lighting: partial.lighting ?? "daytime",
    scale: partial.scale ?? "medium",
  });

  if (p.includes("village") || p.includes("town")) {
    return base({
      scene_type: "village",
      terrain: "flat_grass",
      layout: "along_road",
      buildings: [
        { type: "house", count: 5, style: "cottage" },
        { type: "building", count: 2, style: "farmhouse" },
      ],
      vegetation: [{ type: "tree", count: 10 }, { type: "pine", count: 4 }],
      vehicles: [{ type: "car", count: 3 }],
      infrastructure: [{ type: "street_light", count: 8 }],
      details: [{ type: "bench", count: 5 }],
    });
  }
  if (p.includes("city") || p.includes("urban")) {
    return base({
      scene_type: "city",
      terrain: "urban_flat",
      layout: "grid",
      buildings: [
        { type: "skyscraper", count: 6 },
        { type: "building", count: 8 },
        { type: "shop", count: 4 },
      ],
      vegetation: [{ type: "tree", count: 5 }],
      vehicles: [{ type: "car", count: 5 }, { type: "truck", count: 2 }],
      infrastructure: [{ type: "street_light", count: 15 }, { type: "traffic_light", count: 4 }],
      details: [{ type: "bench", count: 5 }, { type: "mailbox", count: 4 }],
    });
  }
  if (p.includes("forest") || p.includes("woods")) {
    return base({
      scene_type: "forest",
      terrain: "forest_floor",
      layout: "scattered",
      buildings: [{ type: "house", count: 1, style: "cabin" }],
      vegetation: [{ type: "pine", count: 20 }, { type: "tree", count: 15 }],
      vehicles: [],
      infrastructure: [],
      details: [{ type: "rock", count: 5 }],
    });
  }
  if (p.includes("beach") || p.includes("coastal")) {
    return base({
      scene_type: "beach",
      terrain: "beach_sand",
      layout: "scattered",
      buildings: [{ type: "house", count: 3, style: "beach" }],
      vegetation: [{ type: "palm", count: 8 }],
      vehicles: [{ type: "boat", count: 2 }],
      infrastructure: [{ type: "street_light", count: 3 }],
      details: [{ type: "bench", count: 4 }],
    });
  }
  if (p.includes("desert")) {
    return base({
      scene_type: "desert",
      terrain: "desert_sand",
      layout: "scattered",
      buildings: [{ type: "building", count: 3 }],
      vegetation: [{ type: "cactus", count: 5 }],
      vehicles: [{ type: "truck", count: 2 }],
      infrastructure: [],
      details: [{ type: "rock", count: 3 }],
    });
  }

  return base({
    scene_type: "village",
    buildings: [{ type: "house", count: 4 }],
    vegetation: [{ type: "tree", count: 8 }],
    vehicles: [{ type: "car", count: 2 }],
    infrastructure: [{ type: "street_light", count: 6 }],
    details: [{ type: "bench", count: 3 }],
  });
}

/**
 * AI outputs ONLY JSON SceneRequest. No Python, no search, no timing.
 */
export async function askAIForSceneJSON(
  userPrompt: string,
  scannedAssets?: ScannedAsset[],
): Promise<SceneRequest> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  if (!apiKey) {
    return defaultSceneFromKeywords(userPrompt);
  }

  let userContent = `User request:\n${userPrompt.trim()}`;
  if (scannedAssets && scannedAssets.length > 0) {
    const lines = scannedAssets
      .slice(0, 80)
      .map((a) => `${(a.path || "").trim()} — ${(a.name || "").trim()}`)
      .filter((l) => l.startsWith("/Game/"));
    if (lines.length) {
      userContent += `\n\nThe user may have these scanned UE assets (for context only; you still output JSON, not paths):\n${lines.join("\n")}`;
    }
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://grand-studio-v2-prod.vercel.app",
        "X-Title": "Grand Studio Scene JSON",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        temperature: 0.25,
        messages: [
          { role: "system", content: SCENE_JSON_SYSTEM },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      return defaultSceneFromKeywords(userPrompt);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const jsonStr = extractJsonObject(raw);
    if (!jsonStr) {
      return defaultSceneFromKeywords(userPrompt);
    }

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    return normalizeSceneRequest(parsed);
  } catch {
    return defaultSceneFromKeywords(userPrompt);
  }
}
