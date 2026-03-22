import { askGrandStudioAI } from "@/lib/ai/grandStudioAI";
import { queueUE5Command } from "@/lib/ue5/commands";
import { createServerClient } from "@/lib/supabase/server";
import { findAssetsForAction, detectEnvironment, type ScannedAsset } from "@/lib/ai/assetResolver2";
import { isRelayOnline } from "@/lib/ue5/relayStatus";
import { generateUE5ImportCode, generateSketchfabImportCode } from "@/lib/ue5/importCode";
import { searchAssets as searchPolyHaven } from "@/lib/polyhaven/client";
import { downloadPolyHavenModelToStorage as downloadPolyHavenModel } from "@/lib/polyhaven/downloadToSupabase";
import { searchModels as searchSketchfab, getDownloadUrl as getSketchfabDownloadUrl } from "@/lib/sketchfab/client";

export type AgentStepAction =
  | "load_landscape"
  | "place_buildings"
  | "place_trees"
  | "place_walls"
  | "place_vehicles"
  | "add_lighting"
  | "add_details"
  | "final_check";

export type AgentStep = {
  stepNumber: number;
  action: AgentStepAction;
  description: string;
  estimatedAssetCount: number;
};

export type AgentAssetSource = "my_assets" | "library" | "both";

export type AgentEvent =
  | { type: "plan"; steps: AgentStep[] }
  | { type: "step_start"; stepNumber: number; description: string }
  | { type: "step_code"; stepNumber: number; code: string }
  | { type: "step_complete"; stepNumber: number; success: boolean }
  | { type: "step_screenshot"; stepNumber: number; screenshotUrl: string | null }
  | {
      type: "importing";
      asset: string;
      source: "polyhaven" | "sketchfab" | "none";
      current?: number;
      total?: number;
    }
  | { type: "error"; stepNumber?: number; message: string }
  | { type: "complete"; summary: string };

type RunAgentLoopArgs = {
  prompt: string;
  projectId: string;
  userId: string;
  scannedAssets: ScannedAsset[];
  assetSource: AgentAssetSource;
  onEvent: (event: AgentEvent) => Promise<void> | void;
};

// ─── Timing ─────────────────────────────────────────────────────────────────

const WAIT_BETWEEN_IMPORT_COMMANDS_MS = 15000;
const RELAY_RETRY_MS = 15000;
const RELAY_MAX_RETRIES = 10;

// ─── Library mode: never embed scanned Fab paths in generated Python ─────────

const FORBIDDEN_LIBRARY_UE_PATH_PREFIXES = [
  "/Game/Fab/",
  "/Game/Survival_Character/",
  "/Game/ProceduralBuildingGenerator/",
  "/Game/Sankoolarts/",
  "/Game/MWLandscapeAutoMaterial/",
] as const;

function codeViolatesLibraryMode(code: string): boolean {
  const withoutCommentLines = code
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
  return FORBIDDEN_LIBRARY_UE_PATH_PREFIXES.some((prefix) => withoutCommentLines.includes(prefix));
}

function filterPathsForLibraryMode(paths: string[]): string[] {
  return paths.filter(
    (p) => !FORBIDDEN_LIBRARY_UE_PATH_PREFIXES.some((prefix) => p.includes(prefix)),
  );
}

// ─── Keyword map (fixed; no AI for search terms) ────────────────────────────

export const SEARCH_KEYWORDS_MAP = {
  house: ["house", "cottage", "cabin", "building", "farmhouse"],
  tree: ["tree", "pine", "oak", "palm", "birch"],
  car: ["car", "sedan", "truck", "suv", "van"],
  wall: ["wall", "fence", "gate", "stone wall"],
  detail: ["bench", "lamp", "barrel", "crate", "mailbox"],
} as const;

export type SearchCategory = keyof typeof SEARCH_KEYWORDS_MAP;

const CATEGORY_ORDER: SearchCategory[] = ["house", "tree", "car", "wall", "detail"];

// ─── Planning (high-level steps for UI only; execution is 3-phase) ────────

function safeParsePlan(text: string): AgentStep[] | null {
  const trimmed = text.trim();
  const raw = trimmed.startsWith("[")
    ? trimmed
    : (() => {
        const m = trimmed.match(/\[[\s\S]*\]/);
        return m ? m[0] : "";
      })();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AgentStep[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map((s, i) => ({
      stepNumber: Number(s.stepNumber ?? i + 1),
      action: (s.action as AgentStepAction) || "add_details",
      description: String(s.description ?? `Step ${i + 1}`),
      estimatedAssetCount: Number(s.estimatedAssetCount ?? 3),
    }));
  } catch {
    return null;
  }
}

function isSimpleRequest(prompt: string): boolean {
  const p = prompt.trim().toLowerCase();
  return (
    /^build\s+1\s+house\.?$/.test(p)
    || /^build\s+1\s+tree\.?$/.test(p)
    || /^add\s+3\s+trees?\.?$/.test(p)
    || /^place\s+a\s+car\.?$/.test(p)
    || /^build\s+\d+\s+house(s)?\.?$/.test(p)
    || /^add\s+\d+\s+trees?\.?$/.test(p)
  );
}

function defaultSimplePlan(prompt: string): AgentStep[] {
  const p = prompt.toLowerCase();
  if (p.includes("tree")) {
    return [
      { stepNumber: 1, action: "place_trees", description: "Trees", estimatedAssetCount: 3 },
      { stepNumber: 2, action: "add_lighting", description: "Lighting", estimatedAssetCount: 1 },
    ];
  }
  if (p.includes("car") || p.includes("vehicle")) {
    return [
      { stepNumber: 1, action: "place_vehicles", description: "Vehicles", estimatedAssetCount: 2 },
      { stepNumber: 2, action: "add_lighting", description: "Lighting", estimatedAssetCount: 1 },
    ];
  }
  return [
    { stepNumber: 1, action: "place_buildings", description: "Buildings", estimatedAssetCount: 2 },
    { stepNumber: 2, action: "place_trees", description: "Trees", estimatedAssetCount: 4 },
    { stepNumber: 3, action: "add_lighting", description: "Lighting", estimatedAssetCount: 1 },
  ];
}

function defaultLibrarySimplePlan(prompt: string): AgentStep[] {
  const p = prompt.toLowerCase();
  const treeOnly = (p.includes("tree") || /^build\s+1\s+tree/.test(p.trim())) && !p.includes("house");
  if (treeOnly) {
    return [
      { stepNumber: 1, action: "place_trees", description: "Trees from library", estimatedAssetCount: 4 },
      { stepNumber: 2, action: "add_lighting", description: "Placement + lighting", estimatedAssetCount: 1 },
    ];
  }
  if (p.includes("car") || p.includes("vehicle")) {
    return [
      { stepNumber: 1, action: "place_vehicles", description: "Vehicles from library", estimatedAssetCount: 2 },
      { stepNumber: 2, action: "add_lighting", description: "Placement + lighting", estimatedAssetCount: 1 },
    ];
  }
  return [
    { stepNumber: 1, action: "place_buildings", description: "Houses from library", estimatedAssetCount: 2 },
    { stepNumber: 2, action: "place_trees", description: "Trees from library", estimatedAssetCount: 4 },
    { stepNumber: 3, action: "add_lighting", description: "Placement + lighting", estimatedAssetCount: 1 },
  ];
}

function defaultPlan(prompt: string): AgentStep[] {
  const env = detectEnvironment(prompt);
  const urban = env === "urban";
  return [
    { stepNumber: 1, action: "load_landscape", description: urban ? "Urban base" : "Terrain base", estimatedAssetCount: 1 },
    { stepNumber: 2, action: "place_buildings", description: "Buildings", estimatedAssetCount: 4 },
    { stepNumber: 3, action: "place_trees", description: "Trees", estimatedAssetCount: 6 },
    { stepNumber: 4, action: "place_walls", description: "Walls", estimatedAssetCount: 3 },
    { stepNumber: 5, action: "add_details", description: "Details", estimatedAssetCount: 4 },
    { stepNumber: 6, action: "add_lighting", description: "Lighting", estimatedAssetCount: 1 },
    { stepNumber: 7, action: "final_check", description: "Done", estimatedAssetCount: 1 },
  ];
}

function defaultLibraryPlan(prompt: string): AgentStep[] {
  const p = prompt.toLowerCase();
  const steps: AgentStep[] = [];
  let n = 1;
  const wantsHouse =
    p.includes("house") || p.includes("building") || p.includes("castle") || /\bbuild\b/.test(p);
  const treeMatch = p.match(/(\d+)\s*trees?/);
  const treeCount = treeMatch ? Math.min(8, Math.max(1, parseInt(treeMatch[1], 10))) : 4;

  if (wantsHouse) {
    steps.push({
      stepNumber: n++,
      action: "place_buildings",
      description: "Houses from library",
      estimatedAssetCount: 2,
    });
  }
  if (p.includes("tree") || p.includes("garden") || p.includes("forest") || p.includes("yard")) {
    steps.push({
      stepNumber: n++,
      action: "place_trees",
      description: "Trees from library",
      estimatedAssetCount: treeCount,
    });
  } else if (wantsHouse) {
    steps.push({
      stepNumber: n++,
      action: "place_trees",
      description: "Trees from library",
      estimatedAssetCount: 4,
    });
  }
  if (p.includes("car") || p.includes("road") || p.includes("vehicle")) {
    steps.push({
      stepNumber: n++,
      action: "place_vehicles",
      description: "Vehicles from library",
      estimatedAssetCount: 2,
    });
  }
  if (p.includes("wall") || p.includes("fence") || p.includes("village")) {
    steps.push({
      stepNumber: n++,
      action: "place_walls",
      description: "Walls from library",
      estimatedAssetCount: 3,
    });
  }
  if (steps.length === 0) {
    return [
      { stepNumber: 1, action: "place_buildings", description: "Models from library", estimatedAssetCount: 2 },
      { stepNumber: 2, action: "add_lighting", description: "Placement + lighting", estimatedAssetCount: 1 },
    ];
  }
  steps.push({
    stepNumber: n++,
    action: "add_lighting",
    description: "Placement + lighting",
    estimatedAssetCount: 1,
  });
  return steps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
}

function normalizeLibraryPlanSteps(steps: AgentStep[]): AgentStep[] {
  return steps
    .filter((s) => s.action !== "load_landscape")
    .map((s, i) => ({ ...s, stepNumber: i + 1 }));
}

function summarizeAssets(assets: ScannedAsset[]): string {
  const paths = assets
    .map((a) => (a.path || "").trim())
    .filter((p) => p.startsWith("/Game/"))
    .slice(0, 200);
  if (paths.length === 0) return "No scanned assets.";
  return paths.map((p) => `- ${p}`).join("\n");
}

function stepActionToCategory(action: AgentStepAction): SearchCategory | null {
  switch (action) {
    case "place_buildings":
      return "house";
    case "place_trees":
      return "tree";
    case "place_vehicles":
      return "car";
    case "place_walls":
      return "wall";
    case "add_details":
      return "detail";
    default:
      return null;
  }
}

/** How many models to source per category from the plan. */
function collectCategoryDemandFromSteps(steps: AgentStep[]): Map<SearchCategory, number> {
  const m = new Map<SearchCategory, number>();
  for (const s of steps) {
    const cat = stepActionToCategory(s.action);
    if (!cat) continue;
    const add = Math.max(1, Math.min(12, s.estimatedAssetCount || 1));
    m.set(cat, (m.get(cat) ?? 0) + add);
  }
  return m;
}

function inferCategoriesFromPrompt(prompt: string): Map<SearchCategory, number> {
  const p = prompt.toLowerCase();
  const m = new Map<SearchCategory, number>();
  if (p.includes("house") || p.includes("cottage") || p.includes("castle") || p.includes("village") || /\bbuild\b/.test(p)) {
    m.set("house", Math.max(m.get("house") ?? 0, 2));
  }
  if (p.includes("tree") || p.includes("forest") || p.includes("garden") || p.includes("park")) {
    m.set("tree", Math.max(m.get("tree") ?? 0, 4));
  }
  if (p.includes("car") || p.includes("vehicle") || p.includes("road") || p.includes("truck")) {
    m.set("car", Math.max(m.get("car") ?? 0, 2));
  }
  if (p.includes("wall") || p.includes("fence") || p.includes("gate")) {
    m.set("wall", Math.max(m.get("wall") ?? 0, 3));
  }
  if (p.includes("bench") || p.includes("lamp") || p.includes("prop") || p.includes("detail")) {
    m.set("detail", Math.max(m.get("detail") ?? 0, 3));
  }
  return m;
}

function mergeDemandMaps(
  a: Map<SearchCategory, number>,
  b: Map<SearchCategory, number>,
): Map<SearchCategory, number> {
  const out = new Map(a);
  for (const [k, v] of b) {
    out.set(k, Math.max(out.get(k) ?? 0, v));
  }
  return out;
}

// ─── Search: unified candidate ───────────────────────────────────────────────

type UnifiedCandidate = {
  dedupeKey: string;
  source: "polyhaven" | "sketchfab";
  name: string;
  downloadCount: number;
  category: SearchCategory;
  polyId?: string;
  sketchfabUid?: string;
};

async function searchOneKeywordBothSources(
  keyword: string,
  category: SearchCategory,
  into: Map<string, UnifiedCandidate>,
): Promise<void> {
  const poly = await searchPolyHaven(keyword, "models", 40);
  for (const a of poly) {
    const key = `ph:${a.id}`;
    if (into.has(key)) continue;
    into.set(key, {
      dedupeKey: key,
      source: "polyhaven",
      name: a.name,
      downloadCount: a.downloadCount,
      category,
      polyId: a.id,
    });
  }

  const token = process.env.SKETCHFAB_API_TOKEN;
  const sketch = await searchSketchfab(keyword, { count: 24, token: token ?? undefined });
  for (const a of sketch) {
    const key = `sf:${a.uid}`;
    if (into.has(key)) continue;
    into.set(key, {
      dedupeKey: key,
      source: "sketchfab",
      name: a.name,
      downloadCount: a.viewCount,
      category,
      sketchfabUid: a.uid,
    });
  }
}

/** STEP A — Search all keywords on Poly Haven + Sketchfab; sort; pick top per category. */
async function searchPhaseBuildCandidates(
  demand: Map<SearchCategory, number>,
): Promise<Map<SearchCategory, UnifiedCandidate[]>> {
  const assetCandidates = new Map<SearchCategory, UnifiedCandidate[]>();

  for (const category of CATEGORY_ORDER) {
    const neededRaw = demand.get(category) ?? 0;
    if (neededRaw <= 0) continue;

    const bucket = new Map<string, UnifiedCandidate>();
    const keywords = [...SEARCH_KEYWORDS_MAP[category]];

    for (const kw of keywords) {
      await searchOneKeywordBothSources(kw, category, bucket);
    }

    const sorted = [...bucket.values()].sort((a, b) => b.downloadCount - a.downloadCount);
    const pickMin = Math.min(5, Math.max(3, Math.min(neededRaw, 5)));
    const pickN = Math.min(5, Math.max(1, pickMin));
    const picked = sorted.slice(0, pickN);
    assetCandidates.set(category, picked);
  }

  return assetCandidates;
}

function flattenImportJobs(
  assetCandidates: Map<SearchCategory, UnifiedCandidate[]>,
): Array<{ category: SearchCategory; candidate: UnifiedCandidate }> {
  const jobs: Array<{ category: SearchCategory; candidate: UnifiedCandidate }> = [];
  for (const category of CATEGORY_ORDER) {
    const list = assetCandidates.get(category) ?? [];
    for (const c of list) {
      jobs.push({ category, candidate: c });
    }
  }
  return jobs;
}

function makeUniqueDestinationName(
  category: SearchCategory,
  candidate: UnifiedCandidate,
  indexOneBased: number,
): string {
  const idPart =
    candidate.source === "polyhaven"
      ? candidate.polyId ?? "ph"
      : candidate.sketchfabUid ?? "sf";
  const safe = `${category}_${candidate.source}_${idPart}_${String(indexOneBased).padStart(2, "0")}`;
  return safe.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 60);
}

type ImportedRecord = { path: string; category: SearchCategory; source: "polyhaven" | "sketchfab" };

async function waitForRelayOrTimeout(): Promise<boolean> {
  for (let i = 0; i < RELAY_MAX_RETRIES; i++) {
    if (await isRelayOnline()) return true;
    await new Promise((r) => setTimeout(r, RELAY_RETRY_MS));
  }
  return false;
}

async function waitForCommand(
  commandId: string,
  timeoutMs = 300000,
): Promise<{ status: string; error?: string }> {
  const supabase = createServerClient();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await supabase
      .from("ue5_commands")
      .select("status, error_log")
      .eq("id", commandId)
      .maybeSingle();
    if (data?.status === "success") return { status: "success" };
    if (data?.status === "error") return { status: "error", error: data.error_log ?? "Unknown error" };
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { status: "timeout", error: "Command timeout" };
}

function expectedUePath(destinationName: string): string {
  return `/Game/GrandStudio/Imported/${destinationName}`;
}

/** STEP B — Import every selected asset with a unique UE destination name. */
async function importPhaseExecuteAll(args: {
  projectId: string;
  jobs: Array<{ category: SearchCategory; candidate: UnifiedCandidate }>;
  onEvent: (event: AgentEvent) => void | Promise<void>;
}): Promise<{ records: ImportedRecord[]; succeeded: number }> {
  const { projectId, jobs, onEvent } = args;
  const records: ImportedRecord[] = [];
  let succeeded = 0;
  const total = jobs.length;
  let lastQueued = 0;

  for (let i = 0; i < jobs.length; i++) {
    const { category, candidate } = jobs[i];
    const n = i + 1;
    const destName = makeUniqueDestinationName(category, candidate, n);

    const label = `[${category}] ${candidate.name}`;
    console.log(
      `IMPORTING ${n}/${total}: ${destName} from ${candidate.source === "polyhaven" ? "Poly Haven" : "Sketchfab"}`,
    );

    await onEvent({
      type: "importing",
      asset: `${destName} (${candidate.name})`,
      source: candidate.source,
      current: n,
      total,
    });

    if (!(await waitForRelayOrTimeout())) {
      await onEvent({ type: "error", message: "Relay offline during import batch." });
      break;
    }

    if (lastQueued > 0) {
      const elapsed = Date.now() - lastQueued;
      if (elapsed < WAIT_BETWEEN_IMPORT_COMMANDS_MS) {
        await new Promise((r) => setTimeout(r, WAIT_BETWEEN_IMPORT_COMMANDS_MS - elapsed));
      }
    }

    let cmdId: string;

    if (candidate.source === "polyhaven" && candidate.polyId) {
      const url = await downloadPolyHavenModel(candidate.polyId);
      if (!url) {
        console.warn(`IMPORT: skip ${candidate.polyId} — no download URL`);
        continue;
      }
      const ext = url.toLowerCase().includes(".fbx") ? "fbx" : "glb";
      const filename = `${candidate.polyId}_${n}.${ext}`;
      const code = generateUE5ImportCode(url, filename, candidate.name, {
        destinationName: destName,
        replaceExisting: false,
        skipSpawnActor: true,
      });
      cmdId = await queueUE5Command(projectId, code, { commandType: "import" });
    } else if (candidate.source === "sketchfab" && candidate.sketchfabUid) {
      const token = process.env.SKETCHFAB_API_TOKEN;
      if (!token) {
        console.warn("IMPORT: Sketchfab token missing, skip");
        continue;
      }
      const dl = await getSketchfabDownloadUrl(candidate.sketchfabUid, token);
      if (!dl) {
        console.warn(`IMPORT: skip Sketchfab ${candidate.sketchfabUid}`);
        continue;
      }
      const zipFile = `sf_${candidate.sketchfabUid}_${n}.zip`;
      const code = generateSketchfabImportCode(dl, zipFile, candidate.name, {
        destinationName: destName,
        replaceExisting: false,
        skipSpawnActor: true,
      });
      cmdId = await queueUE5Command(projectId, code, { commandType: "import" });
    } else {
      continue;
    }

    lastQueued = Date.now();
    const result = await waitForCommand(cmdId);
    if (result.status !== "success") {
      await onEvent({
        type: "error",
        message: `Import failed: ${candidate.name} — ${result.error ?? result.status}`,
      });
      continue;
    }

    succeeded += 1;
    const supabase = createServerClient();
    const { data: importRow } = await supabase
      .from("ue5_import_assets")
      .select("ue_asset_path")
      .eq("ue5_command_id", cmdId)
      .maybeSingle();
    const path = importRow?.ue_asset_path ?? expectedUePath(destName);
    records.push({ path, category, source: candidate.source });
  }

  return { records, succeeded };
}

function escapePyPath(p: string): string {
  return p.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** STEP C — One Python script: place houses on a grid, trees random, cars on a line, walls perimeter, details scattered + lighting + camera. */
function buildConsolidatedPlacementPython(
  records: ImportedRecord[],
  libraryMode: boolean,
): string {
  const byCat = (c: SearchCategory) => records.filter((r) => r.category === c).map((r) => r.path);

  const houses = byCat("house");
  const trees = byCat("tree");
  const cars = byCat("car");
  const walls = byCat("wall");
  const details = byCat("detail");

  const preamble = libraryMode
    ? `# Library/batch placement — only imported asset paths below.
`
    : "";

  const pyList = (arr: string[]) => `[${arr.map((p) => `'${escapePyPath(p)}'`).join(", ")}]`;

  return `${preamble}import unreal
import random
import math
random.seed(42)

editor = unreal.EditorLevelLibrary

house_paths = ${pyList(houses)}
tree_paths = ${pyList(trees)}
car_paths = ${pyList(cars)}
wall_paths = ${pyList(walls)}
detail_paths = ${pyList(details)}

def spawn_at(path, loc, label):
    a = unreal.EditorAssetLibrary.load_asset(path)
    if not a:
        return None
    act = editor.spawn_actor_from_object(a, loc)
    if act:
        act.set_actor_label(label)
    return act

# Houses — grid
for i, p in enumerate(house_paths):
    row, col = divmod(i, 3)
    spawn_at(p, unreal.Vector(float(col) * 900.0, float(row) * 1100.0, 0.0), 'House_%d' % i)

# Trees — pseudo-random scatter between houses
for i, p in enumerate(tree_paths):
    x = random.uniform(-1500.0, 3500.0)
    y = random.uniform(-1500.0, 3500.0)
    spawn_at(p, unreal.Vector(x, y, 0.0), 'Tree_%d' % i)

# Cars — road line along X
for i, p in enumerate(car_paths):
    spawn_at(p, unreal.Vector(float(i) * 450.0 - 500.0, -800.0, 0.0), 'Car_%d' % i)

# Walls — circle perimeter
wall_radius = 2200.0
for i, p in enumerate(wall_paths):
    angle = (2.0 * math.pi / max(len(wall_paths), 1)) * float(i)
    spawn_at(p, unreal.Vector(wall_radius * math.cos(angle), wall_radius * math.sin(angle), 0.0), 'Wall_%d' % i)

# Details — random
for i, p in enumerate(detail_paths):
    spawn_at(p, unreal.Vector(random.uniform(0, 2800), random.uniform(0, 2800), 0.0), 'Detail_%d' % i)

# Lighting — one directional sun (matches project templates)
try:
    sun = editor.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(-4000, -4000, 2500))
    if sun:
        sun.set_actor_rotation(unreal.Rotator(-50.0, 28.0, 0.0), False)
except Exception:
    pass

# Camera for overview
try:
    cam = editor.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(2600, -2600, 650))
    if cam:
        cam.set_actor_rotation(unreal.Rotator(-14.0, 42.0, 0.0), False)
except Exception:
    pass

unreal.log('GrandStudio batch placement done.')
`;
}

// ─── My assets: scans only, single placement ─────────────────────────────────

async function runMyAssetsPipeline(args: {
  steps: AgentStep[];
  prompt: string;
  projectId: string;
  scannedAssets: ScannedAsset[];
  onEvent: (event: AgentEvent) => void | Promise<void>;
}): Promise<{ completed: number; placementOk: boolean }> {
  const { steps, projectId, scannedAssets, onEvent } = args;
  const records: ImportedRecord[] = [];

  for (const step of steps) {
    const cat = stepActionToCategory(step.action);
    if (!cat) continue;
    const { found } = findAssetsForAction(step.action, scannedAssets);
    for (const p of found) {
      records.push({ path: p, category: cat, source: "polyhaven" });
    }
  }

  const unique = new Map<string, ImportedRecord>();
  for (const r of records) {
    if (!unique.has(r.path)) unique.set(r.path, r);
  }
  const list = [...unique.values()];

  await onEvent({ type: "step_start", stepNumber: 1, description: "Place scanned assets (single pass)" });
  const code = buildConsolidatedPlacementPython(list, false);
  await onEvent({ type: "step_code", stepNumber: 1, code });

  let placementOk = false;
  if (await waitForRelayOrTimeout()) {
    const cmdId = await queueUE5Command(projectId, code, { commandType: "import" });
    const result = await waitForCommand(cmdId);
    placementOk = result.status === "success";
    if (!placementOk) {
      await onEvent({ type: "error", stepNumber: 1, message: result.error ?? "Placement failed" });
    }
  } else {
    await onEvent({ type: "error", message: "Relay offline" });
  }

  await onEvent({ type: "step_complete", stepNumber: 1, success: placementOk });
  return { completed: placementOk ? steps.length : 0, placementOk };
}

// ─── Main loop ───────────────────────────────────────────────────────────────

export async function runAgentLoop(args: RunAgentLoopArgs): Promise<{ summary: string; steps: AgentStep[] }> {
  const { prompt, projectId, scannedAssets, assetSource, onEvent } = args;

  const effectiveScannedAssets: ScannedAsset[] = assetSource === "library" ? [] : scannedAssets;

  if (assetSource === "library") {
    console.log(
      "AGENT: Asset source mode = library. Scanned assets DISABLED. Using ONLY Poly Haven and Sketchfab imports.",
    );
  }

  const planningPrompt =
    assetSource === "library"
      ? `You are a scene planner. Output ONLY a JSON array of steps with: stepNumber, action, description, estimatedAssetCount.

The user has NO local assets. Plan which kinds of models to use: place_buildings, place_trees, place_walls, place_vehicles, add_details, add_lighting, final_check.
Do not reference /Game/ paths. Execution will search Poly Haven + Sketchfab in batch (you only list intent).

User request:
${prompt}`
      : `You are a scene planner. Output ONLY a JSON array of steps with: stepNumber, action, description, estimatedAssetCount.

User request:
${prompt}

Scanned assets:
${summarizeAssets(effectiveScannedAssets)}`;

  let steps: AgentStep[] = [];
  try {
    const planResp = await askGrandStudioAI(planningPrompt);
    steps =
      safeParsePlan(planResp.rawResponse)
      ?? (assetSource === "library" ? defaultLibraryPlan(prompt) : defaultPlan(prompt));
  } catch {
    steps = assetSource === "library" ? defaultLibraryPlan(prompt) : defaultPlan(prompt);
  }

  if (isSimpleRequest(prompt)) {
    steps = assetSource === "library" ? defaultLibrarySimplePlan(prompt) : defaultSimplePlan(prompt);
  }
  if (assetSource === "library") {
    steps = normalizeLibraryPlanSteps(steps);
    if (steps.length === 0) steps = defaultLibraryPlan(prompt);
  }

  await onEvent({ type: "plan", steps });

  if (assetSource === "my_assets") {
    const { completed, placementOk } = await runMyAssetsPipeline({
      steps,
      prompt,
      projectId,
      scannedAssets,
      onEvent,
    });
    let screenshotUrl: string | null = null;
    if (placementOk) {
      await onEvent({ type: "step_start", stepNumber: 2, description: "Screenshot" });
      if (await waitForRelayOrTimeout()) {
        const sid = await queueUE5Command(projectId, "", { commandType: "screenshot" });
        await waitForCommand(sid);
        const supabase = createServerClient();
        const { data } = await supabase
          .from("ue5_commands")
          .select("screenshot_url")
          .eq("id", sid)
          .maybeSingle();
        screenshotUrl = data?.screenshot_url ?? null;
      }
      await onEvent({ type: "step_screenshot", stepNumber: 2, screenshotUrl });
    }
    const summary = `My-assets pipeline: placement ${placementOk ? "ok" : "failed"}. Steps: ${steps.length}.`;
    await onEvent({ type: "complete", summary });
    return { summary, steps };
  }

  // ─── library + both: Phase A → B → C → D ───

  let demand = collectCategoryDemandFromSteps(steps);
  demand = mergeDemandMaps(demand, inferCategoriesFromPrompt(prompt));
  if ([...demand.values()].every((v) => v <= 0)) {
    demand.set("house", 2);
    demand.set("tree", 3);
  }

  await onEvent({ type: "step_start", stepNumber: 1, description: "Phase A — Search Poly Haven + Sketchfab (all keywords)" });
  const assetCandidates = await searchPhaseBuildCandidates(demand);
  const totalCandidates = [...assetCandidates.values()].reduce((a, b) => a + b.length, 0);
  console.log(`AGENT: Search phase done. Candidate models: ${totalCandidates} across categories.`);

  await onEvent({ type: "step_complete", stepNumber: 1, success: totalCandidates > 0 });
  if (totalCandidates === 0) {
    const summary = "Search phase found no models. Check API keys / network.";
    await onEvent({ type: "error", message: summary });
    await onEvent({ type: "complete", summary });
    return { summary, steps };
  }

  const jobs = flattenImportJobs(assetCandidates);

  await onEvent({ type: "step_start", stepNumber: 2, description: "Phase B — Import all models (unique names)" });
  const { records: importedLib, succeeded } = await importPhaseExecuteAll({
    projectId,
    jobs,
    onEvent,
  });

  let records: ImportedRecord[] = [...importedLib];

  if (assetSource === "both") {
    for (const step of steps) {
      const cat = stepActionToCategory(step.action);
      if (!cat) continue;
      const { found } = findAssetsForAction(step.action, scannedAssets);
      for (const p of filterPathsForLibraryMode(found)) {
        records.push({ path: p, category: cat, source: "polyhaven" });
      }
    }
  }

  const dedupe = new Map<string, ImportedRecord>();
  for (const r of records) {
    if (!dedupe.has(r.path)) dedupe.set(r.path, r);
  }
  records = [...dedupe.values()];

  await onEvent({ type: "step_complete", stepNumber: 2, success: succeeded > 0 });

  if (records.length === 0) {
    const summary =
      "Nothing to place: every import failed and no scanned assets were available for this plan.";
    await onEvent({ type: "error", message: summary });
    await onEvent({ type: "complete", summary });
    return { summary, steps };
  }

  await onEvent({ type: "step_start", stepNumber: 3, description: "Phase C — Place all (single UE command)" });
  let code = buildConsolidatedPlacementPython(records, assetSource === "library");
  if (assetSource === "library" && codeViolatesLibraryMode(code)) {
    console.warn("AGENT: Stripped forbidden paths from placement code.");
    const safeRec = records.filter((r) =>
      !FORBIDDEN_LIBRARY_UE_PATH_PREFIXES.some((pre) => r.path.includes(pre)),
    );
    code = buildConsolidatedPlacementPython(safeRec, true);
  }

  await onEvent({ type: "step_code", stepNumber: 3, code });

  let placementOk = false;
  if (await waitForRelayOrTimeout()) {
    const cmdId = await queueUE5Command(projectId, code, { commandType: "import" });
    const result = await waitForCommand(cmdId, 600000);
    placementOk = result.status === "success";
    if (!placementOk) {
      await onEvent({ type: "error", stepNumber: 3, message: result.error ?? "Placement command failed" });
    }
  } else {
    await onEvent({ type: "error", message: "Relay offline for placement" });
  }

  await onEvent({ type: "step_complete", stepNumber: 3, success: placementOk });

  let screenshotUrl: string | null = null;
  if (placementOk) {
    await onEvent({ type: "step_start", stepNumber: 4, description: "Phase D — Screenshot" });
    if (await waitForRelayOrTimeout()) {
      const sid = await queueUE5Command(projectId, "", { commandType: "screenshot" });
      await waitForCommand(sid);
      const supabase = createServerClient();
      const { data } = await supabase
        .from("ue5_commands")
        .select("screenshot_url")
        .eq("id", sid)
        .maybeSingle();
      screenshotUrl = data?.screenshot_url ?? null;
    }
    await onEvent({ type: "step_screenshot", stepNumber: 4, screenshotUrl });
    await onEvent({ type: "step_complete", stepNumber: 4, success: !!screenshotUrl });
  }

  const summary = `Phased agent: search → import (${succeeded}/${jobs.length}) → place → screenshot. Records in scene: ${records.length}. Asset source: ${assetSource}.`;
  await onEvent({ type: "complete", summary });
  return { summary, steps };
}
