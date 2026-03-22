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

CRITICAL — FEW UNIQUE MODEL IMPORTS (the engine hard-limits to 15 unique library imports per scene):
- Prefer FEWER object TYPES and higher "count" per type so the same imported model can be INSTANCED many times at placement (repeated positions, varied rotation/scale). Do NOT list dozens of unique types.
- Small village / town: at most 2 buildings total, 3 trees/plants, 1 vehicle, 2 infrastructure (e.g. street lights), 1 detail (e.g. bench) — ~9 placed instances, ~5–6 unique imports.
- Large city: at most 6 buildings, 6 trees, 2 vehicles, 5 infrastructure, 3 details — about 22 placed instances but at most 15 UNIQUE imports; reuse types with count>1.
- Forest: 0–1 building, up to 12 trees total (split types ok), 0–4 details; keep unique types low.
- Beach / desert / other: keep totals modest; prefer repeating the same types with count.

Rules:
- Do not write any text before or after the JSON. Do not write Python. Do not explain.
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
  return { type, count: Math.min(30, Math.floor(count)), style, size };
}

function sumCounts(objects: SceneObject[]): number {
  return objects.reduce((s, o) => s + o.count, 0);
}

/** Scale down counts so category total does not exceed maxTotal (min 1 per row while possible). */
function capCategoryTotal(objects: SceneObject[], maxTotal: number): SceneObject[] {
  if (objects.length === 0 || maxTotal <= 0) return [];
  let out = objects.filter((o) => o.count >= 1).map((o) => ({ ...o }));
  if (out.length === 0) return [];
  let total = sumCounts(out);
  if (total <= maxTotal) return out;
  const factor = maxTotal / total;
  out = out.map((o) => ({
    ...o,
    count: Math.max(1, Math.floor(o.count * factor)),
  }));
  total = sumCounts(out);
  while (total > maxTotal) {
    const idx = out.reduce((best, o, i) => (o.count > out[best].count ? i : best), 0);
    if (out[idx].count <= 1) break;
    out[idx] = { ...out[idx], count: out[idx].count - 1 };
    total -= 1;
  }
  return out.filter((o) => o.count >= 1);
}

/** Enforce per–scene-type instance budgets; keeps unique imports low via fewer types + higher counts. */
export function enforceSceneImportBudgets(sr: SceneRequest): SceneRequest {
  const st = sr.scene_type;
  let b: number;
  let v: number;
  let veh: number;
  let inf: number;
  let det: number;
  let ch: number;

  if (st === "village") {
    b = 2;
    v = 3;
    veh = 1;
    inf = 2;
    det = 1;
    ch = 0;
  } else if (st === "city") {
    b = 6;
    v = 6;
    veh = 2;
    inf = 5;
    det = 3;
    ch = 0;
  } else if (st === "forest") {
    b = 1;
    v = 12;
    veh = 0;
    inf = 0;
    det = 4;
    ch = 0;
  } else if (st === "beach") {
    b = 3;
    v = 5;
    veh = 2;
    inf = 2;
    det = 3;
    ch = 0;
  } else if (st === "desert") {
    b = 3;
    v = 4;
    veh = 2;
    inf = 0;
    det = 3;
    ch = 0;
  } else {
    b = 5;
    v = 5;
    veh = 2;
    inf = 4;
    det = 3;
    ch = 0;
  }

  return {
    ...sr,
    buildings: capCategoryTotal(sr.buildings, b),
    vegetation: capCategoryTotal(sr.vegetation, v),
    vehicles: capCategoryTotal(sr.vehicles, veh),
    infrastructure: capCategoryTotal(sr.infrastructure, inf),
    details: capCategoryTotal(sr.details, det),
    characters: capCategoryTotal(sr.characters, ch),
  };
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

  const base: SceneRequest = {
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
  return enforceSceneImportBudgets(base);
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
    return enforceSceneImportBudgets(
      base({
        scene_type: "village",
        terrain: "flat_grass",
        layout: "along_road",
        buildings: [
          { type: "house", count: 1, style: "cottage" },
          { type: "building", count: 1, style: "farmhouse" },
        ],
        vegetation: [{ type: "tree", count: 3 }],
        vehicles: [{ type: "car", count: 1 }],
        infrastructure: [{ type: "street_light", count: 2 }],
        details: [{ type: "bench", count: 1 }],
      }),
    );
  }
  if (p.includes("city") || p.includes("urban")) {
    return enforceSceneImportBudgets(
      base({
        scene_type: "city",
        terrain: "urban_flat",
        layout: "grid",
        buildings: [
          { type: "skyscraper", count: 2 },
          { type: "building", count: 2 },
          { type: "shop", count: 2 },
        ],
        vegetation: [{ type: "tree", count: 4 }, { type: "pine", count: 2 }],
        vehicles: [{ type: "car", count: 1 }, { type: "truck", count: 1 }],
        infrastructure: [{ type: "street_light", count: 3 }, { type: "traffic_light", count: 2 }],
        details: [{ type: "bench", count: 2 }, { type: "mailbox", count: 1 }],
      }),
    );
  }
  if (p.includes("forest") || p.includes("woods")) {
    return enforceSceneImportBudgets(
      base({
        scene_type: "forest",
        terrain: "forest_floor",
        layout: "scattered",
        buildings: [{ type: "house", count: 1, style: "cabin" }],
        vegetation: [{ type: "pine", count: 8 }, { type: "tree", count: 4 }],
        vehicles: [],
        infrastructure: [],
        details: [{ type: "rock", count: 3 }],
      }),
    );
  }
  if (p.includes("beach") || p.includes("coastal")) {
    return enforceSceneImportBudgets(
      base({
        scene_type: "beach",
        terrain: "beach_sand",
        layout: "scattered",
        buildings: [{ type: "house", count: 2, style: "beach" }],
        vegetation: [{ type: "palm", count: 3 }],
        vehicles: [{ type: "boat", count: 1 }],
        infrastructure: [{ type: "street_light", count: 1 }],
        details: [{ type: "bench", count: 2 }],
      }),
    );
  }
  if (p.includes("desert")) {
    return enforceSceneImportBudgets(
      base({
        scene_type: "desert",
        terrain: "desert_sand",
        layout: "scattered",
        buildings: [{ type: "building", count: 2 }],
        vegetation: [{ type: "cactus", count: 3 }],
        vehicles: [{ type: "truck", count: 1 }],
        infrastructure: [],
        details: [{ type: "rock", count: 2 }],
      }),
    );
  }

  return enforceSceneImportBudgets(
    base({
      scene_type: "village",
      buildings: [
        { type: "house", count: 1 },
        { type: "building", count: 1 },
      ],
      vegetation: [{ type: "tree", count: 3 }],
      vehicles: [{ type: "car", count: 1 }],
      infrastructure: [{ type: "street_light", count: 2 }],
      details: [{ type: "bench", count: 1 }],
    }),
  );
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
