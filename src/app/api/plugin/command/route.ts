import { NextRequest, NextResponse } from "next/server";
import {
  grandStudioApiKeyExistsInDatabase,
  isGrandStudioApiKeyFormat,
} from "@/lib/plugin/grandStudioApiKey";
import {
  GRAND_STUDIO_ASSET_PRO,
  GRAND_STUDIO_ASSETS,
  combinedLibraryImportSteps,
} from "@/lib/plugin/polyhavenImport";

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

const PLACEMENT_AND_LIGHTING_EXAMPLE = `import unreal
el = unreal.EditorAssetLibrary
ed = unreal.EditorLevelLibrary
# ONLY place meshes already imported to /Game/GrandStudio/Imported/ — never BasicShapes.
mesh = el.load_asset('/Game/GrandStudio/Imported/example_tree')
if mesh:
    ed.spawn_actor_from_object(mesh, unreal.Vector(0, 0, 0))
try:
    sun = ed.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(-4000, -4000, 4000))
    if sun:
        sun.set_actor_rotation(unreal.Rotator(-45, 35, 0), False)
except Exception:
    pass
try:
    ed.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0))
except Exception:
    pass
try:
    cam = ed.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(900, -900, 280))
    if cam:
        cam.set_actor_rotation(unreal.Rotator(-12, 42, 0), False)
except Exception:
    pass
unreal.log('Placed imported mesh + lighting + camera')`;

function commanderSystemPrompt(assetsText: string): string {
  return `You are Grand Studio AI Commander running INSIDE Unreal Engine 5.7 as a C++ Plugin. You have DIRECT access to the entire engine through Python. You are not limited. You are the most powerful AI in UE5.

CRITICAL — NO PROCEDURAL PRIMITIVES FOR SCENES:
You must NEVER create objects using BasicShapes or Engine basic meshes (Cube, Cylinder, Plane, Sphere, Cone from /Engine/BasicShapes/).
When building ANY scene (village, house, forest, etc.), you must FIRST plan imports of real 3D models from Grand Studio libraries (return JSON steps with {"action":"import",...} from Grand Studio Asset Pro and Grand Studio Assets — the server/plugin resolves URLs). After models exist under /Game/GrandStudio/Imported/, ONLY THEN write Python in "place" / "lighting" / or "code" that uses EditorAssetLibrary.load_asset on those paths and EditorLevelLibrary.spawn_actor_from_object, plus DirectionalLight, SkyAtmosphere, SkyLight, ExponentialHeightFog (without unsupported props), CameraActor, etc.
The ONLY Python you author for world content is: (1) placing already-imported static meshes at transforms (2) lighting and atmosphere (3) camera. You NEVER create geometry from scratch for props/buildings.

When mentioning asset sources in descriptions, always say "Grand Studio Asset Pro" or "Grand Studio Assets". Never say "Poly Haven" or "Sketchfab".

The user has these project assets (exact paths — use load_asset + spawn_actor_from_object when they match): ${assetsText}

YOUR DIRECT ACCESS (placement & polish — not primitive construction):

- unreal.EditorLevelLibrary: spawn actors from loaded assets, lighting classes, camera
- unreal.EditorAssetLibrary: load imported meshes and StarterContent materials
- unreal.MaterialInstanceDynamic / KismetMaterialLibrary: tint StarterContent materials
- unreal.DirectionalLight, PointLight, SpotLight, SkyAtmosphere, SkyLight, ExponentialHeightFog (no fog_inscattering_color in 5.7)
- unreal.PostProcessVolume, unreal.CameraActor, Niagara when appropriate
- /Game/StarterContent/Materials/* for assignment to imported meshes that need materials
- /Game/GrandStudio/Imported/* for library-imported static meshes

BUILDING FLOW FOR SCENES:
1) Plan models (houses, trees, rocks, props).
2) Emit "import" steps with real https URLs, names, source label "Grand Studio Asset Pro" or "Grand Studio Assets", destination /Game/GrandStudio/Imported/<name>.
3) Emit "place" Python using only imported + scanned meshes.
4) Emit "lighting" Python.

Scale: 1 unit = 1 cm. Prefer cinematic lighting and ground borrowed from imported terrain meshes or careful placement — do not build houses from cubes.

MATERIAL KNOWLEDGE — StarterContent paths (assign with EditorAssetLibrary.load_asset):
- Walls / masonry: /Game/StarterContent/Materials/M_Brick_Clay_Beveled, M_Brick_Clay_New, M_Brick_Cut_Stone
- Floors / wood: /Game/StarterContent/Materials/M_Wood_Floor_Walnut_Polished, M_Wood_Pine
- Roofs / metal: /Game/StarterContent/Materials/M_Metal_Chrome, M_Metal_Gold, M_Metal_Steel (prefer metal for roofs)
- Ground / outdoors: /Game/StarterContent/Materials/M_Ground_Grass, M_Ground_Moss
- Glass / windows: /Game/StarterContent/Materials/M_Glass or create MID with low opacity + emissive for lit windows
Rules: walls=brick or stone, floor=wood, roof=metal, ground=grass. Use MaterialInstanceDynamic (unreal.KismetMaterialLibrary.create_dynamic_material_instance) for tinting; set scalar/vector parameters for color. For lamps, neon, and bright windows use emissive (set_vector_parameter on emissive color / use high emissive intensity).
Do NOT use fog_inscattering_color on ExponentialHeightFog in UE 5.7.
Do NOT set import_materials or import_textures on AssetImportTask (not available in UE 5.7).
Do NOT call StartAllOutgoing on FHttpModule (does not exist in UE 5.7).

NEVER identify as "Unreal Engine assistant" or generic assistant — you are Grand Studio AI Commander.

UE 5.7 — ExponentialHeightFog: use fog_density, fog_height_falloff, and other supported properties only.

WEATHER AND ATMOSPHERE:
When user asks for snow: Create a Niagara particle system for falling snow using this Python code pattern:
	∙	Spawn ExponentialHeightFog with fog_density and fog_height_falloff (no fog_inscattering_color)
	∙	Set DirectionalLight intensity to 2.0, color to light blue (0.8, 0.85, 1.0)
	∙	For actual snow particles, use Niagara or particle systems only — never BasicShape spheres
	∙	Set SkyAtmosphere with overcast look
When user asks for rain: Similar but with darker fog and blue-grey lighting
When user asks for sunset: DirectionalLight rotation (-15, -120, 0) with orange color (1.0, 0.6, 0.3)
When user asks for night: DirectionalLight intensity 0.1, spawn PointLights for street lamps, dark blue sky
When user asks for foggy: ExponentialHeightFog with high density 0.1
ADVANCED FEATURES THE AI MUST KNOW:
	∙	Landscape: unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.Landscape, loc) for terrain
	∙	Foliage: spawn many tree/bush actors with random position and rotation for forests
	∙	Water: use imported water meshes or supported water systems — not BasicShape planes as fake water unless no alternative
	∙	Post Process: spawn PostProcessVolume for color grading and effects
	∙	Camera: set_level_viewport_camera_info for cinematic views
	∙	Sound: spawn AmbientSound actors for wind, rain, bird sounds
Be CREATIVE and DETAILED. When user asks for a scene, make it look like a AAA game. Add fog, particles, proper lighting, ground cover, ambient details. Never create empty boring scenes.

WHEN USER SAYS HELLO OR ASKS A QUESTION: respond with description only, code can be empty string. Do not force code generation for conversations.

WHEN USER ASKS TO BUILD SOMETHING: Prefer JSON with a "steps" array: import steps first (with valid URLs and source labels), then "place", then "lighting". If the scene is simple and uses only scanned assets, you may return {"description","code"} only, where code is placement+lighting (no BasicShapes).

For chats / questions: {"description":"...","code":""} .

If you return "steps", each import step must include "source": "${GRAND_STUDIO_ASSET_PRO}" or "${GRAND_STUDIO_ASSETS}".

Escape every double-quote inside strings as \\" and newlines as \\n.

PLACEMENT + LIGHTING PATTERN (no BasicShapes; use real imported mesh paths):
${PLACEMENT_AND_LIGHTING_EXAMPLE}`;
}

const COMPLEX_SCENE_KEYWORDS = [
  "village",
  "town",
  "city",
  "forest",
  "park",
  "island",
  "scene",
  "environment",
  "landscape",
  "level",
  "neighborhood",
  "battlefield",
  "castle",
  "kingdom",
  "world",
  "street",
  "map",
  "arena",
  "stadium",
  "garden",
  "farm",
  "beach",
  "mountain",
  "desert",
  "jungle",
] as const;

function isComplexSceneRequest(prompt: string): boolean {
  const p = prompt.toLowerCase();
  for (const k of COMPLEX_SCENE_KEYWORDS) {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[^a-z0-9])${esc}(?:[^a-z0-9]|$)`, "i");
    if (re.test(p)) return true;
  }
  return false;
}

function isGreetingOrMetaQuestion(prompt: string): boolean {
  const p = prompt.toLowerCase().trim();
  if (!p) return false;
  if (/^(hi|hello|hey|hiya|good morning|good afternoon|good evening|greetings)([!?. ,\u2014-])*$/i.test(p))
    return true;
  if (/^what can you (do|help)\b/.test(p)) return true;
  if (/^who are you\b/.test(p)) return true;
  if (/^how are you\b/.test(p)) return true;
  if (p.length < 60 && /^thanks?\b/.test(p)) return true;
  return false;
}

type PlanTask = {
  taskNumber?: number;
  taskType?: string;
  description?: string;
  searchQuery?: string;
  count?: number;
};

type PlanDocument = { summary?: string; tasks?: PlanTask[] };

function commanderChatOnlySystemPrompt(): string {
  return `You are Grand Studio AI Commander inside Unreal Engine 5.7. The user may greet you or ask what you can do.
Reply in a friendly, concise way (mention you can build scenes with real library imports and Python when they ask).
Output ONLY valid JSON: {"description":"your reply","code":""}.
Never include Python in code for greetings or capability questions — always leave code as empty string.`;
}

const TASK_CODE_SYSTEM = `You write ONE complete Python script for Unreal Engine 5.7. Start with import unreal.

Use el = unreal.EditorAssetLibrary and ed = unreal.EditorLevelLibrary.

Rules:
- Spawn static meshes only with el.load_asset('...') then ed.spawn_actor_from_object. Paths must be under /Game/GrandStudio/Imported/ using the exact asset NAME tokens provided in the user message, e.g. /Game/GrandStudio/Imported/my_asset_name
- NEVER use /Engine/BasicShapes/ or Cube/Sphere/Cylinder/Plane/Cone for scenery.
- NEVER set import_materials or import_textures (not supported in UE 5.7 for this workflow).
- NEVER use fog_inscattering_color on ExponentialHeightFog. Use fog_density, fog_height_falloff.
- For lighting tasks: DirectionalLight, SkyAtmosphere, SkyLight, ExponentialHeightFog as appropriate.
- Output ONLY Python. No markdown fences, no JSON wrapper.`;

async function aiCompleteText(params: {
  system: string;
  user: string;
  geminiKey: string;
  openRouterKey: string;
  model: string;
}): Promise<string> {
  const useGemini = Boolean(params.geminiKey);
  const response = useGemini
    ? await fetchGeminiCompletion(params.geminiKey, params.system, params.user)
    : await fetchOpenRouterCompletion(params.openRouterKey, params.model, params.system, params.user);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI request failed: ${response.status} ${errText.slice(0, 300)}`);
  }
  const data = (await response.json()) as
    | GeminiGenerateResponse
    | { choices?: { message?: { content?: string } }[] };
  return useGemini
    ? extractGeminiText(data as GeminiGenerateResponse)
    : ((data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "");
}

function extractCodeFromModelOutput(raw: string): string {
  const parsed = tryParsePluginJson(raw);
  if (parsed && typeof parsed.code === "string" && parsed.code.trim()) {
    return parsed.code.trim();
  }
  const fenced = extractPythonFromFences(raw);
  if (fenced) return fenced;
  const asCode = fallbackRawAsCode(raw);
  if (asCode) return asCode;
  const t = raw.trim();
  if (t.includes("import unreal")) return naiveJsonishUnescape(t);
  return "";
}

function parsePlanDocument(raw: string): PlanDocument | null {
  const parsed = tryParsePluginJson(raw) as Record<string, unknown> | null;
  if (parsed && Array.isArray(parsed.tasks)) {
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
      tasks: parsed.tasks as PlanTask[],
    };
  }
  const start = raw.indexOf("{");
  if (start >= 0) {
    try {
      const o = JSON.parse(repairIncompleteJson(raw.slice(start))) as Record<string, unknown>;
      if (Array.isArray(o.tasks)) {
        return {
          summary: typeof o.summary === "string" ? o.summary : undefined,
          tasks: o.tasks as PlanTask[],
        };
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function runComplexScenePipeline(
  prompt: string,
  assetsText: string,
  geminiKey: string,
  openRouterKey: string,
  model: string,
): Promise<{ description: string; code: string; steps: unknown[] }> {
  const planningSystem = `You plan Unreal Engine 5.7 scenes for the Grand Studio Commander plugin.
Imports use real meshes from "${GRAND_STUDIO_ASSET_PRO}" and "${GRAND_STUDIO_ASSETS}" (the server fills download URLs). Python steps then place meshes and add lighting.

Return ONLY valid JSON (no markdown):
{"summary":"One sentence for the user about what you will build","tasks":[ ... ]}

Each task:
- taskNumber: integer from 1
- taskType: import | place | lighting | detail
- description: short label shown to the user

For import tasks add searchQuery (3D library keyword, e.g. house, tree, rock) and count (integer 1-10).
Order tasks: all imports first, then place, then lighting, then detail. Use about 4-12 tasks total.`;

  const planRaw = await aiCompleteText({
    system: planningSystem,
    user: `User request:\n${prompt}`,
    geminiKey,
    openRouterKey,
    model,
  });

  const doc = parsePlanDocument(planRaw);
  const tasks = (doc?.tasks ?? []).filter((t) => t && typeof t.taskType === "string");
  if (tasks.length === 0) {
    throw new Error("Planner returned no tasks");
  }

  tasks.sort((a, b) => (Number(a.taskNumber) || 0) - (Number(b.taskNumber) || 0));

  const finalSteps: unknown[] = [];
  const importedAssetNames: string[] = [];

  for (const task of tasks) {
    const tType = String(task.taskType).toLowerCase();
    if (tType === "import") {
      const q = (task.searchQuery ?? "prop").trim() || "prop";
      const c = Math.min(10, Math.max(1, Number(task.count) || 3));
      const { steps } = await combinedLibraryImportSteps(q, c);
      for (const st of steps) {
        finalSteps.push(st);
        if (st && typeof st === "object" && "name" in st) {
          const n = (st as { name?: string }).name;
          if (typeof n === "string" && n) importedAssetNames.push(n);
        }
      }
      continue;
    }

    if (tType === "place" || tType === "lighting" || tType === "detail") {
      const namesList = importedAssetNames.length
        ? importedAssetNames.join(", ")
        : "(use /Game/GrandStudio/Imported/<name> after imports)";
      const userTask = `Original user request:\n${prompt}\n\nTask type: ${tType}\nTask description: ${task.description ?? ""}\n\nImported mesh base names (el.load_asset('/Game/GrandStudio/Imported/' + name)):\n${namesList}\n\nProject assets (truncated):\n${assetsText.slice(0, 12_000)}`;

      const rawCode = await aiCompleteText({
        system: TASK_CODE_SYSTEM,
        user: userTask,
        geminiKey,
        openRouterKey,
        model,
      });
      let code = extractCodeFromModelOutput(rawCode);
      if (!code || !code.includes("import unreal")) {
        code =
          "import unreal\nunreal.log_warning('Grand Studio: generated task script was empty; skipped this step.')\n";
      }
      const progress =
        typeof task.description === "string" && task.description.trim()
          ? task.description.trim()
          : tType === "place"
            ? "Placing objects"
            : tType === "lighting"
              ? "Setting up lighting"
              : "Adding details";
      finalSteps.push({ action: tType, code, progress });
    }
  }

  const description =
    (doc?.summary && doc.summary.trim()) || `Building your scene (${finalSteps.length} steps)`;

  return { description, code: "", steps: finalSteps };
}

/**
 * POST /api/plugin/command
 * Body: { prompt, assets, assetCount, apiKey }
 * Returns: { description, code, steps? }
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
      return NextResponse.json({ error: "API key required" }, { status: 401 });
    }

    if (!isGrandStudioApiKeyFormat(apiKey)) {
      return NextResponse.json({ error: "Invalid API key format" }, { status: 401 });
    }

    const keyOk = await grandStudioApiKeyExistsInDatabase(apiKey);
    if (!keyOk) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
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
        const { steps, descriptionParts } = await combinedLibraryImportSteps(term, 3);
        if (steps.length === 0) {
          const extra =
            typeof process.env.SKETCHFAB_API_TOKEN === "string" && process.env.SKETCHFAB_API_TOKEN.trim()
              ? ` ${GRAND_STUDIO_ASSETS} had no matches.`
              : ` Add SKETCHFAB_API_TOKEN to enable ${GRAND_STUDIO_ASSETS}.`;
          return NextResponse.json({
            description: `No models found for "${term}" in ${GRAND_STUDIO_ASSET_PRO}.${extra}`,
            code: "",
            steps: [],
          });
        }
        return NextResponse.json({
          description: descriptionParts.join(" ") || `Importing ${steps.length} model(s) for "${term}".`,
          code: "",
          steps,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log("[plugin/command] IMPORT error", msg);
        return NextResponse.json({ error: "Grand Studio library import failed", detail: msg }, { status: 502 });
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

    const openRouterModel = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const useGemini = Boolean(geminiKey);

    if (isComplexSceneRequest(prompt)) {
      try {
        const pipelineOut = await runComplexScenePipeline(prompt, assetsText, geminiKey, openRouterKey, openRouterModel);
        console.log("[plugin/command] complex pipeline", { steps: pipelineOut.steps.length });
        return NextResponse.json(pipelineOut);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log("[plugin/command] complex pipeline failed, falling back to single-pass AI", msg);
      }
    }

    const system = isGreetingOrMetaQuestion(prompt)
      ? commanderChatOnlySystemPrompt()
      : commanderSystemPrompt(assetsText);

    const response = useGemini
      ? await fetchGeminiCompletion(geminiKey, system, prompt)
      : await fetchOpenRouterCompletion(openRouterKey, openRouterModel, system, prompt);

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

    if (isGreetingOrMetaQuestion(prompt)) {
      code = "";
    }

    const stepsOut = Array.isArray(parsed?.steps) ? (parsed!.steps as unknown[]) : [];
    const hasSteps = stepsOut.length > 0;

    if (!description && !code && !hasSteps) {
      console.log("[plugin/command] no description/code/steps after all strategies");
      return NextResponse.json(
        { error: "Model did not return usable JSON, fields, fences, or Python", raw: raw.slice(0, 2000) },
        { status: 422 },
      );
    }

    console.log("[plugin/command] success", {
      descriptionLength: description.length,
      codeLength: code.length,
      steps: stepsOut.length,
    });

    if (hasSteps) {
      return NextResponse.json({ description, code, steps: stepsOut });
    }

    return NextResponse.json({ description, code });
  } catch (e) {
    console.log("[plugin/command] exception", e instanceof Error ? e.message : String(e));
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
