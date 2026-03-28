import { NextRequest, NextResponse } from "next/server";
import { buildPolyHavenImportPython, polyHavenTopModelsWithFbx } from "@/lib/plugin/polyhavenImport";

const DEFAULT_MODEL = "anthropic/claude-3-5-sonnet-20241022";
const GEMINI_GENERATE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

type GeminiGenerateResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  error?: { message?: string; code?: number };
};

function extractGeminiText(data: GeminiGenerateResponse): string {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts?.length) return "";
  return parts.map((p) => p.text ?? "").join("");
}

async function fetchGeminiCompletion(apiKey: string, systemPrompt: string, userPrompt: string): Promise<Response> {
  const url = `${GEMINI_GENERATE_URL}?key=${encodeURIComponent(apiKey)}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "I understand. I will follow your instructions." }] },
        { role: "user", parts: [{ text: userPrompt }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 32000,
      },
    }),
  });
}

async function fetchOpenRouterCompletion(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<Response> {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://grand-studio-v2-prod.vercel.app",
      "X-Title": "Grand Studio AI Commander Plugin",
    },
    body: JSON.stringify({
      model,
      max_tokens: 32000,
      temperature: 0.25,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
}

/** Slice from first `{` through end of text (may be incomplete). */
function extractJsonCandidate(text: string): string | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  if (start < 0) return null;
  return trimmed.slice(start);
}

/**
 * Best-effort repair: close an open string, then `]`, then `}` to balance JSON structure.
 * Brace/bracket counts ignore characters inside quoted strings.
 */
function repairIncompleteJson(input: string): string {
  let s = input;
  let depth = 0;
  let bdepth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === "[") bdepth++;
    else if (c === "]") bdepth--;
  }
  let out = s;
  if (inString) out += '"';
  while (bdepth > 0) {
    out += "]";
    bdepth--;
  }
  while (depth > 0) {
    out += "}";
    depth--;
  }
  return out;
}

function tryParsePluginJson(text: string): Record<string, unknown> | null {
  const candidate = extractJsonCandidate(text);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(repairIncompleteJson(candidate)) as Record<string, unknown>;
    } catch {
      return tryParseWithEscapedQuotePlaceholder(candidate)
        ?? tryParseWithEscapedQuotePlaceholder(repairIncompleteJson(candidate));
    }
  }
}

const JSON_ESC_QUOTE_PLACEHOLDER = "\uE000PLACEHOLDER_QUOTE\uE001";

/**
 * Try JSON.parse after replacing escaped quotes inside the payload so naive parsers succeed.
 * Restores placeholders only in string values — best-effort: replace all \\\" then parse.
 */
function tryParseWithEscapedQuotePlaceholder(candidate: string): Record<string, unknown> | null {
  if (!candidate.trim()) return null;
  const patched = candidate.replace(/\\"/g, JSON_ESC_QUOTE_PLACEHOLDER);
  try {
    const o = JSON.parse(patched) as Record<string, unknown>;
    const walk = (v: unknown): unknown => {
      if (typeof v === "string") {
        return v.split(JSON_ESC_QUOTE_PLACEHOLDER).join('"');
      }
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === "object")
        return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, walk(val)]));
      return v;
    };
    return walk(o) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extract a JSON string value for `field` after `"field": "` using JSON escape rules.
 * Handles \\\", \\n, etc. Truncated responses: returns unclosed content as the value.
 */
function extractJsonStringValue(raw: string, field: string): string | null {
  const esc = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`"${esc}"\\s*:\\s*"`, "im");
  const m = re.exec(raw);
  if (!m || m.index === undefined) return null;
  let i = m.index + m[0].length;
  let out = "";
  while (i < raw.length) {
    const c = raw[i];
    if (c === "\\" && i + 1 < raw.length) {
      const n = raw[i + 1];
      if (n === "n") {
        out += "\n";
        i += 2;
        continue;
      }
      if (n === "r") {
        out += "\r";
        i += 2;
        continue;
      }
      if (n === "t") {
        out += "\t";
        i += 2;
        continue;
      }
      if (n === '"') {
        out += '"';
        i += 2;
        continue;
      }
      if (n === "\\") {
        out += "\\";
        i += 2;
        continue;
      }
      out += c;
      i++;
      continue;
    }
    if (c === '"') return out;
    out += c;
    i++;
  }
  return out.length > 0 ? out : null;
}

function naiveJsonishUnescape(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/** If the model returned mostly Python (no usable JSON wrapper). */
function fallbackRawAsCode(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("import unreal")) return naiveJsonishUnescape(t);
  const idx = t.indexOf("import unreal");
  if (idx >= 0 && t.includes("unreal.")) return naiveJsonishUnescape(t.slice(idx));
  return null;
}

/** First ```python or ``` fenced block in the raw response. */
function extractPythonFromFences(text: string): string | null {
  const re = /```(?:python)?\s*([\s\S]*?)```/;
  const m = text.match(re);
  if (!m?.[1]) return null;
  const body = m[1].trim();
  return body || null;
}

function formatAssetsForPrompt(assets: unknown): string {
  if (typeof assets === "string") {
    return assets.slice(0, 200_000);
  }
  try {
    return JSON.stringify(assets, null, 0).slice(0, 200_000);
  } catch {
    return String(assets ?? "");
  }
}

function extractClientApiKey(request: NextRequest, body: Record<string, unknown>): string {
  const h = request.headers.get("x-grandstudio-key");
  const headerKey = typeof h === "string" ? h.trim() : "";
  const bodyKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  return bodyKey || headerKey;
}

const HOUSE_WITH_MATERIALS_EXAMPLE = `import unreal
editor = unreal.EditorLevelLibrary
el = unreal.EditorAssetLibrary
MAT_WALL = '/Game/StarterContent/Materials/M_Brick_Clay_Beveled'
MAT_FLOOR_ROOF = '/Game/StarterContent/Materials/M_Wood_Floor_Walnut_Polished'
MAT_GROUND = '/Game/StarterContent/Materials/M_Ground_Grass'

def smat(act, mat_path):
    if not act: return
    smc = act.get_component_by_class(unreal.StaticMeshComponent)
    mat = el.load_asset(mat_path)
    if smc and mat:
        smc.set_material(0, mat)

def scube(loc, scale3d, mat_path):
    a = el.load_asset('/Engine/BasicShapes/Cube')
    if not a: return None
    act = editor.spawn_actor_from_object(a, loc)
    if not act: return None
    act.set_actor_scale3d(scale3d)
    smat(act, mat_path)
    return act

def splane(loc, scale3d, mat_path):
    a = el.load_asset('/Engine/BasicShapes/Plane')
    if not a: return None
    act = editor.spawn_actor_from_object(a, loc)
    if not act: return None
    act.set_actor_scale3d(scale3d)
    smat(act, mat_path)
    return act

# Units: centimeters. Default BasicShapes cube ~100; scales multiply that.
splane(unreal.Vector(0, 0, 0), unreal.Vector(40, 40, 1), MAT_GROUND)
scube(unreal.Vector(0, 0, 5), unreal.Vector(6, 6, 0.1), MAT_FLOOR_ROOF)
# Four walls ~200 cm tall, door gap: two wall segments on south (+Y) side with space between
scube(unreal.Vector(0, -300, 110), unreal.Vector(6, 0.2, 2), MAT_WALL)
scube(unreal.Vector(0, 300, 110), unreal.Vector(6, 0.2, 2), MAT_WALL)
scube(unreal.Vector(-300, 0, 110), unreal.Vector(0.2, 6, 2), MAT_WALL)
scube(unreal.Vector(300, -150, 110), unreal.Vector(0.2, 3, 2), MAT_WALL)
scube(unreal.Vector(300, 150, 110), unreal.Vector(0.2, 3, 2), MAT_WALL)
scube(unreal.Vector(0, 0, 260), unreal.Vector(6.2, 6.2, 0.15), MAT_FLOOR_ROOF)
try:
    sun = editor.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(-4000, -4000, 4000))
    if sun:
        sun.set_actor_rotation(unreal.Rotator(-45, 35, 0), False)
except Exception:
    pass
try:
    editor.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0))
except Exception:
    pass
try:
    cam = editor.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(900, -900, 280))
    if cam:
        cam.set_actor_rotation(unreal.Rotator(-12, 42, 0), False)
except Exception:
    pass
unreal.log('Complete house: ground, floor, walls with door gap, roof, materials, sun, sky, camera')`;

function commanderSystemPrompt(assetsText: string): string {
  return `You are Grand Studio AI Commander running INSIDE Unreal Engine 5.7 as a C++ Plugin. You have DIRECT access to the entire engine through Python. You are not limited. You are the most powerful AI in UE5.

The user has these project assets (use exact paths with load_asset + spawn_actor_from_object when they fit the request; otherwise use BasicShapes + StarterContent as below): ${assetsText}

YOUR DIRECT ACCESS:

- unreal.EditorLevelLibrary: spawn actors, delete actors, get all actors, set viewport camera
- unreal.EditorAssetLibrary: list ALL assets in /Game/, load any asset, create folders
- unreal.AssetToolsHelpers: import FBX/OBJ/GLB files from disk
- unreal.StaticMesh: access and modify any mesh
- unreal.MaterialInstanceDynamic: create materials with any color, texture, roughness, metallic
- unreal.KismetMaterialLibrary: create dynamic material instances
- unreal.Landscape: create and sculpt terrain
- unreal.FoliageType: paint thousands of trees and plants
- unreal.NiagaraActor: particle effects (snow, rain, fire, smoke)
- unreal.ExponentialHeightFog: fog and atmosphere
- unreal.DirectionalLight, PointLight, SpotLight: all lighting
- unreal.SkyAtmosphere, SkyLight: sky and ambient light
- unreal.PostProcessVolume: color grading, bloom, DOF
- unreal.CameraActor: cinematic cameras
- unreal.SoundBase, AmbientSound: audio
- unreal.BlueprintGeneratedClass: spawn blueprint actors
- All /Game/StarterContent/ materials and meshes
- All user project assets found by scan

BUILDING STANDARDS:
Every building MUST have: floor, 4 walls, roof, door opening, at least 2 windows, material on EVERY surface.
Materials: M_Brick_Clay_Beveled for walls, M_Wood_Floor_Walnut_Polished for floor/roof, M_Ground_Grass for ground.
Every scene MUST have: ground plane, DirectionalLight, SkyAtmosphere, SkyLight, camera at end.
Scale: 1 unit = 1 cm. Human = 180 units. Door = 100x200. Wall = 400-600 wide x 300 tall.

NEVER build incomplete scenes. NEVER leave surfaces without materials. NEVER forget lighting.

GRAND STUDIO SERVER ROLE: You generate Python that the Grand Studio UE5 plugin runs in the user's Editor. Use the scanned asset list above for exact paths. When imported Poly Haven content exists under /Game/GrandStudio/Imported/, prefer those static meshes for props and environment pieces that match the user's request.

MATERIAL KNOWLEDGE: You can assign StarterContent materials, create MaterialInstanceDynamic via KismetMaterialLibrary + BasicShapeMaterial, or create new Material assets with AssetTools. Every visible surface should have a material.

UE 5.7 — ExponentialHeightFog: do NOT use fog_inscattering_color (unreliable / not available like older tutorials). Use fog_density, fog_height_falloff, and other fog properties documented for UE 5.7 only.

WEATHER AND ATMOSPHERE:
When user asks for snow: Create a Niagara particle system for falling snow using this Python code pattern:
	∙	Spawn ExponentialHeightFog with FogDensity 0.05, FogHeightFalloff 0.2, color white/light blue
	∙	Set DirectionalLight intensity to 2.0, color to light blue (0.8, 0.85, 1.0)
	∙	For actual snow particles, use: unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.NiagaraActor, location) if available, OR create many small white sphere actors falling from sky as simple snow
	∙	Set SkyAtmosphere with overcast look
When user asks for rain: Similar but with darker fog and blue-grey lighting
When user asks for sunset: DirectionalLight rotation (-15, -120, 0) with orange color (1.0, 0.6, 0.3)
When user asks for night: DirectionalLight intensity 0.1, spawn PointLights for street lamps, dark blue sky
When user asks for foggy: ExponentialHeightFog with high density 0.1
ADVANCED FEATURES THE AI MUST KNOW:
	∙	Landscape: unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.Landscape, loc) for terrain
	∙	Foliage: spawn many tree/bush actors with random position and rotation for forests
	∙	Water: spawn water plane actor for lakes and rivers
	∙	Post Process: spawn PostProcessVolume for color grading and effects
	∙	Camera: set_level_viewport_camera_info for cinematic views
	∙	Sound: spawn AmbientSound actors for wind, rain, bird sounds
Be CREATIVE and DETAILED. When user asks for a scene, make it look like a AAA game. Add fog, particles, proper lighting, ground cover, ambient details. Never create empty boring scenes.

WHEN USER SAYS HELLO OR ASKS A QUESTION: respond with description only, code can be empty string. Do not force code generation for conversations.

WHEN USER ASKS TO BUILD SOMETHING: respond with description explaining what you will build AND complete Python code that builds everything including materials and lighting.

Python may use up to 200 lines. End with unreal.log describing what was built.

For build requests reply with ONLY valid JSON (no markdown fences, no text outside JSON):
{"description":"short friendly plan what you will build","code":"..."}

Escape every double-quote inside the code string as \\" and newlines as \\n.

EXACT PATTERN EXAMPLE (follow this structure; adapt sizes, add door/window cuts, use user assets when they match house parts):
${HOUSE_WITH_MATERIALS_EXAMPLE}`;
}

/**
 * POST /api/plugin/command
 * Body: { prompt, assets, assetCount }
 * Returns: { description, code }
 */
export async function POST(request: NextRequest) {
  try {
    let bodyRaw: Record<string, unknown> = {};
    try {
      bodyRaw = (await request.json()) as Record<string, unknown>;
    } catch {
      bodyRaw = {};
    }

    const apiKey = extractClientApiKey(request, bodyRaw);
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key required. Get your key at https://grandstudio.dev/dashboard" },
        { status: 401 },
      );
    }

    const prompt = typeof bodyRaw.prompt === "string" ? bodyRaw.prompt.trim() : "";
    const assetCount = bodyRaw.assetCount;
    const assetsText = formatAssetsForPrompt(bodyRaw.assets ?? []);

    console.log("[plugin/command] received", {
      promptLength: prompt.length,
      assetCount,
      assetsTextLength: assetsText.length,
      hasApiKey: Boolean(apiKey),
    });

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const importMatch = prompt.match(/^IMPORT:\s*(.*)$/i);
    if (importMatch) {
      const term = importMatch[1]?.trim() ?? "";
      if (!term) {
        return NextResponse.json(
          { error: "IMPORT: requires a search term (e.g. IMPORT:tree)" },
          { status: 400 },
        );
      }
      try {
        const hits = await polyHavenTopModelsWithFbx(term, 3);
        if (hits.length === 0) {
          return NextResponse.json({
            description: `No Poly Haven FBX models found for "${term}".`,
            code: "",
          });
        }
        const names = hits.map((h) => h.name).join(", ");
        const code = buildPolyHavenImportPython(hits);
        return NextResponse.json({
          description: `Importing ${hits.length} models: ${names}`,
          code,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log("[plugin/command] IMPORT error", msg);
        return NextResponse.json({ error: "Poly Haven import failed", detail: msg }, { status: 502 });
      }
    }

    const geminiKey = typeof process.env.GEMINI_API_KEY === "string" ? process.env.GEMINI_API_KEY.trim() : "";
    const openRouterKey =
      typeof process.env.OPENROUTER_API_KEY === "string" ? process.env.OPENROUTER_API_KEY.trim() : "";
    if (!geminiKey && !openRouterKey) {
      console.log("[plugin/command] missing GEMINI_API_KEY and OPENROUTER_API_KEY");
      return NextResponse.json(
        { error: "AI not configured. Set GEMINI_API_KEY (preferred) or OPENROUTER_API_KEY." },
        { status: 503 },
      );
    }

    const system = commanderSystemPrompt(assetsText);
    const useGemini = Boolean(geminiKey);

    const response = useGemini
      ? await fetchGeminiCompletion(geminiKey, system, prompt)
      : await fetchOpenRouterCompletion(
          openRouterKey,
          process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
          system,
          prompt,
        );

    console.log("[plugin/command]", useGemini ? "Gemini" : "OpenRouter", "status", response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.log("[plugin/command] AI error body", errText.slice(0, 500));
      return NextResponse.json(
        { error: "AI request failed", detail: errText.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = (await response.json()) as
      | GeminiGenerateResponse
      | { choices?: { message?: { content?: string } }[] };
    const raw = useGemini
      ? extractGeminiText(data as GeminiGenerateResponse)
      : ((data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "");
    console.log("[plugin/command] raw response length", raw.length);

    let parsed = tryParsePluginJson(raw);
    if (parsed) {
      console.log("[plugin/command] JSON parse ok (raw, repair, or quote-placeholder)");
    } else {
      console.log("[plugin/command] JSON.parse paths failed, will extract fields or fallbacks");
    }

    let description = typeof parsed?.description === "string" ? parsed.description : "";
    let code = typeof parsed?.code === "string" ? parsed.code : "";

    if (!description || !code) {
      const d = extractJsonStringValue(raw, "description");
      const c = extractJsonStringValue(raw, "code");
      if (d) description = d;
      if (c) code = c;
      if (d || c) console.log("[plugin/command] used manual JSON string extraction", { hasD: !!d, hasC: !!c });
    }

    if (!code) {
      const fenced = extractPythonFromFences(raw);
      if (fenced) {
        code = fenced;
        if (!description) description = "Recovered Python from markdown code fence in model output.";
        console.log("[plugin/command] using fallback fenced code", { codeLength: code.length });
      }
    }

    if (!code) {
      const asCode = fallbackRawAsCode(raw);
      if (asCode) {
        code = asCode;
        if (!description) description = "Recovered: model output treated as Python.";
        console.log("[plugin/command] using raw-as-code fallback", { codeLength: code.length });
      }
    }

    if (!code) {
      const stripped = naiveJsonishUnescape(raw.trim());
      if (stripped.includes("import unreal")) {
        code = stripped;
        if (!description) description = "Recovered: full raw response unescaped as Python.";
        console.log("[plugin/command] using full raw unescape as code");
      }
    }

    if (!description && !code) {
      console.log("[plugin/command] no description/code after all strategies");
      return NextResponse.json(
        { error: "Model did not return usable JSON, fields, fences, or Python", raw: raw.slice(0, 2000) },
        { status: 422 },
      );
    }

    console.log("[plugin/command] success", { descriptionLength: description.length, codeLength: code.length });

    return NextResponse.json({ description, code });
  } catch (e) {
    console.log("[plugin/command] exception", e instanceof Error ? e.message : String(e));
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
