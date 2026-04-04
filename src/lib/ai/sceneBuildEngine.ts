import { createServerClient } from "@/lib/supabase/server";
import { queueRelayDownloadThenImport, queueUE5Command } from "@/lib/ue5/commands";
import {
  diffuseFileExtensionFromUrl,
  generateSketchfabLocalImportCode,
  generateUE5ImportCode,
} from "@/lib/ue5/importCode";
import { searchAssets as searchPolyHaven } from "@/lib/polyhaven/client";
import { downloadPolyHavenModelToStorage as downloadPolyHavenModel } from "@/lib/polyhaven/downloadToSupabase";
import { searchModels as searchSketchfab, getDownloadUrl as getSketchfabDownloadUrl } from "@/lib/sketchfab/client";
import { isRelayOnline } from "@/lib/ue5/relayStatus";
import type { SceneRequest, SceneObject, SceneObjectCategory, AssetSourceMode } from "@/lib/ai/sceneSchema";
import {
  updateAgentProgress,
  type SerializedAssetCandidate,
  type ImportedAssetRecord,
  type SearchSnapshot,
  parseSearchSnapshot,
} from "@/lib/ai/agentProgress";

type ScannedAsset = { path?: string; name?: string; type?: string };

export type SceneBuildProgressEvent =
  | { type: "plan"; sceneRequest: SceneRequest }
  | { type: "search"; message: string }
  | { type: "importing"; current: number; total: number; name: string; source: string }
  | { type: "placing"; message: string }
  | { type: "complete"; summary: string }
  | { type: "error"; message: string }
  | { type: "chunk_pause"; message: string; sessionId: string };

/** 240s work per Vercel request (60s buffer before 300s limit) */
export const CHUNK_DEADLINE_MS = 240_000;

/** Leave at least this much chunk time for Phase 3 placement (skip remaining imports). */
const PLACEMENT_TIME_RESERVE_MS = 60_000;

/** After this elapsed time in a chunk, stop importing if we already have enough models. */
const IMPORT_STOP_AFTER_ELAPSED_MS = 180_000;

export type BuildSceneOutcome = "completed" | "paused" | "error";

export type BuildSceneParams = {
  sceneRequest: SceneRequest;
  projectId: string;
  userId: string;
  assetSource: AssetSourceMode;
  scannedAssets: ScannedAsset[];
  progressCallback: (ev: SceneBuildProgressEvent) => void | Promise<void>;
  chunkStartTime: number;
  sessionId: string;
  progressRowId: string;
  cumulativeElapsedMsBase: number;
  resumePhase: "search" | "import" | "place" | "screenshot" | null;
  resumeSearchSnapshot: SearchSnapshot | null;
  resumeImportQueue: SerializedAssetCandidate[];
  resumeImportedAssets: ImportedAssetRecord[];
  resumeImportedCount: number;
  resumeTotalImports: number;
  resumePlacementDone: boolean;
  resumeScreenshotDone: boolean;
};

const SEARCH_MAP: Record<string, string[]> = {
  house: ["house", "cottage", "cabin", "residential building"],
  building: ["building", "office building", "commercial building"],
  skyscraper: ["skyscraper", "tall building", "tower"],
  shop: ["shop", "store", "retail"],
  hospital: ["hospital", "medical building", "clinic"],
  church: ["church", "chapel"],
  castle: ["castle", "fortress", "medieval building"],
  tavern: ["tavern", "inn", "pub"],
  tree: ["tree", "oak tree", "deciduous tree"],
  pine: ["pine tree", "conifer", "spruce"],
  palm: ["palm tree", "tropical tree", "coconut palm"],
  cactus: ["cactus", "desert plant"],
  bush: ["bush", "shrub", "hedge"],
  car: ["car", "sedan", "automobile"],
  truck: ["truck", "pickup truck", "van"],
  boat: ["boat", "sailboat", "fishing boat"],
  street_light: ["street light", "lamp post", "lantern"],
  traffic_light: ["traffic light", "traffic signal", "stop light"],
  bench: ["bench", "park bench", "garden bench"],
  rock: ["rock", "boulder", "stone"],
  barrel: ["barrel", "wooden barrel"],
  crate: ["crate", "wooden crate", "box"],
  fence: ["fence", "wooden fence", "garden fence"],
  wall: ["wall", "stone wall", "brick wall"],
  mailbox: ["mailbox", "post box"],
  fire_hydrant: ["fire hydrant"],
  road: ["road", "street", "pathway"],
};

/** Hard cap: unique library imports per scene (reuse models in placement for more instances) */
const MAX_IMPORTS_PER_SCENE = 15;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Clears relay download temp folder only — not /Game/GrandStudio/Imported. Runs once per agent import session. */
const CLEAN_DOWNLOADS_PYTHON = `import os
import shutil
dl_path = 'C:/GrandStudio/Downloads'
if os.path.exists(dl_path):
    shutil.rmtree(dl_path)
os.makedirs(dl_path)
unreal.log('Cleaned downloads folder')
`;

function keywordsForType(objectType: string): string[] {
  const t = objectType.toLowerCase().trim();
  return SEARCH_MAP[t] ?? [t, `${t} model`, `3d ${t}`];
}

function scannedMatchesType(path: string, name: string, objectType: string): boolean {
  const t = objectType.toLowerCase();
  const hay = `${path} ${name}`.toLowerCase();
  const kws = keywordsForType(objectType);
  return kws.some((k) => {
    const parts = k.toLowerCase().split(/\s+/).filter(Boolean);
    return parts.some((p) => p.length > 2 && hay.includes(p));
  });
}

function collectScannedForType(scanned: ScannedAsset[], objectType: string, max: number): string[] {
  const out: string[] = [];
  for (const a of scanned) {
    const p = (a.path || "").trim();
    if (!p.startsWith("/Game/")) continue;
    if (scannedMatchesType(p, a.name || "", objectType)) {
      out.push(p);
      if (out.length >= max) break;
    }
  }
  return out;
}

type LibraryHit = {
  key: string;
  source: "polyhaven" | "sketchfab";
  name: string;
  downloadCount: number;
  polyId?: string;
  sketchfabUid?: string;
};

async function searchLibrariesForType(objectType: string): Promise<LibraryHit[]> {
  const bucket = new Map<string, LibraryHit>();
  const kws = keywordsForType(objectType);

  for (const kw of kws) {
    try {
      const poly = await searchPolyHaven(kw, "models", 24);
      for (const a of poly) {
        const key = `ph:${a.id}`;
        if (bucket.has(key)) continue;
        bucket.set(key, {
          key,
          source: "polyhaven",
          name: a.name,
          downloadCount: a.downloadCount,
          polyId: a.id,
        });
      }
    } catch {
      /* ignore */
    }
    await sleep(1000);
  }

  if (bucket.size === 0) {
    for (const kw of kws) {
      try {
        const sketch = await searchSketchfab(kw, {
          count: 16,
          token: process.env.SKETCHFAB_API_TOKEN ?? undefined,
        });
        for (const a of sketch) {
          const key = `sf:${a.uid}`;
          if (bucket.has(key)) continue;
          bucket.set(key, {
            key,
            source: "sketchfab",
            name: a.name,
            downloadCount: a.viewCount,
            sketchfabUid: a.uid,
          });
        }
      } catch {
        /* ignore */
      }
      await sleep(1000);
    }
  }

  const list = [...bucket.values()];
  list.sort((a, b) => {
    const ap = a.source === "polyhaven" ? 1 : 0;
    const bp = b.source === "polyhaven" ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return b.downloadCount - a.downloadCount;
  });
  return list;
}

export type AssetCandidate = {
  id: string;
  name: string;
  source: "polyhaven" | "sketchfab" | "scanned";
  objectType: string;
  category: SceneObjectCategory;
  downloadUrl?: string | null;
  scanPath?: string | null;
  polyId?: string;
  sketchfabUid?: string;
  downloadCount: number;
};

async function waitRelayWithRetries(maxAttempts = 5): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isRelayOnline()) return true;
    await sleep(15000);
  }
  return false;
}

/** Before each import: wait 20s between attempts, up to 5 times; if still offline, skip this import. */
async function ensureRelayBeforeImport(): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await isRelayOnline()) return true;
    await sleep(20_000);
  }
  return false;
}

async function waitForCommand(commandId: string, timeoutMs = 300000): Promise<{ status: string; error?: string }> {
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
    await sleep(3000);
  }
  return { status: "timeout", error: "Command timeout" };
}

function isHeavyBuildingType(t: string): boolean {
  return /house|building|castle|skyscraper|shop|hospital|church|tavern|hospital/i.test(t);
}

function scaleToHalfExtent(scale: SceneRequest["scale"]): number {
  if (scale === "small") return 1500;
  if (scale === "large") return 5000;
  return 3000;
}

type PlaceSlot = {
  path: string;
  category: SceneObjectCategory;
  objectType: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
};

function computeSlots(
  scene: SceneRequest,
  pathsBySlot: Array<{ category: SceneObjectCategory; objectType: string; path: string }>,
): PlaceSlot[] {
  const half = scaleToHalfExtent(scene.scale);
  const layout = scene.layout;
  const n = pathsBySlot.length;
  if (n === 0) return [];

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const slots: PlaceSlot[] = [];

  let bi = 0;
  let ti = 0;
  let vi = 0;
  let ii = 0;
  let di = 0;
  let ci = 0;

  const countCat = (c: SceneObjectCategory) => pathsBySlot.filter((p) => p.category === c).length;

  const nb = countCat("buildings");
  const nt = countCat("vegetation");
  const nv = countCat("vehicles");
  const ni = countCat("infrastructure");
  const nd = countCat("details");
  const nc = countCat("characters");

  for (let idx = 0; idx < pathsBySlot.length; idx++) {
    const row = pathsBySlot[idx];
    let x = 0;
    let y = 0;
    let z = 0;
    let yaw = rand(0, 15) * (Math.PI / 180);
    let sc = 1.0;

    if (row.category === "buildings") {
      const i = bi++;
      const instJitter = ((idx * 137.508) % 360) * (Math.PI / 180);
      yaw += instJitter * 0.4;
      sc *= 0.92 + ((idx * 73) % 17) / 100;
      if (layout === "grid") {
        const cols = Math.max(1, Math.ceil(Math.sqrt(nb)));
        const r = Math.floor(i / cols);
        const c = i % cols;
        x = c * 900 - (cols * 450);
        y = r * 1000;
        z = 0;
        yaw += rand(-0.05, 0.05);
      } else if (layout === "circle") {
        const angle = (2 * Math.PI * i) / Math.max(nb, 1);
        const rad = half * 0.65;
        x = Math.cos(angle) * rad;
        y = Math.sin(angle) * rad;
      } else if (layout === "along_road") {
        const side = i % 2 === 0 ? 1 : -1;
        x = (i >> 1) * 700 - nb * 150;
        y = side * 550;
      } else if (layout === "clustered") {
        const cluster = Math.floor(i / 4);
        const ox = (cluster % 3) * 2000 - 2000;
        const oy = Math.floor(cluster / 3) * 2000 - 1000;
        x = ox + rand(-400, 400);
        y = oy + rand(-400, 400);
      } else {
        x = rand(-half, half);
        y = rand(-half, half);
      }
    } else if (row.category === "vegetation") {
      const i = ti++;
      x = rand(-half * 0.95, half * 0.95);
      y = rand(-half * 0.95, half * 0.95);
      sc = rand(0.85, 1.15) * (0.92 + ((idx * 61) % 17) / 100);
      yaw = rand(0, 360) * (Math.PI / 180) + ((idx * 97) % 45) * (Math.PI / 180);
    } else if (row.category === "vehicles") {
      const i = vi++;
      x = i * 500 - nv * 250;
      y = -half * 0.55;
      yaw = rand(-0.08, 0.08) + ((idx * 53) % 90) * (Math.PI / 180);
      sc = 0.95 + ((idx * 41) % 12) / 100;
    } else if (row.category === "infrastructure") {
      const i = ii++;
      if (layout === "along_road" || layout === "grid") {
        x = (i / Math.max(ni, 1)) * (half * 1.6) - half * 0.8;
        y = 400;
      } else {
        x = rand(-half, half);
        y = rand(-half, half);
      }
    } else if (row.category === "details") {
      const i = di++;
      x = rand(-half * 0.8, half * 0.8);
      y = rand(-half * 0.8, half * 0.8);
      yaw = rand(0, 180) * (Math.PI / 180);
    } else {
      const i = ci++;
      x = rand(-half * 0.5, half * 0.5);
      y = rand(-half * 0.5, half * 0.5);
    }

    slots.push({
      path: row.path,
      category: row.category,
      objectType: row.objectType,
      x,
      y,
      z,
      yaw,
      scale: sc,
    });
  }

  return slots;
}

function lightingToSunRot(lighting: SceneRequest["lighting"]): { pitch: number; yaw: number; roll: number } {
  switch (lighting) {
    case "sunset":
      return { pitch: -25, yaw: -120, roll: 0 };
    case "night":
      return { pitch: -10, yaw: -60, roll: 0 };
    case "dawn":
      return { pitch: -20, yaw: 40, roll: 0 };
    case "overcast":
      return { pitch: -55, yaw: -30, roll: 0 };
    default:
      return { pitch: -40, yaw: -30, roll: 0 };
  }
}

function escapePy(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Last path segment without extension — used to match discovered StaticMeshes under subfolders */
function matchKeyFromUePath(path: string): string {
  const normalized = path.replace(/\\/g, "/").trim();
  const parts = normalized.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  if (!last) return "";
  return last.includes(".") ? last.split(".").slice(0, -1).join(".") : last;
}

/**
 * Placement: discover StaticMeshes under /Game/GrandStudio/Imported recursively, then match by asset name
 * to the paths we stored (which may omit subfolders like scene/StaticMeshes/).
 */
export function generatePlacementCode(scene: SceneRequest, slots: PlaceSlot[]): string {
  const sun = lightingToSunRot(scene.lighting);
  const lines: string[] = [
    "import unreal",
    "editor = unreal.EditorLevelLibrary",
    "",
    "def spawn_mesh(path, loc, yaw_deg, scale3d):",
    "    a = unreal.EditorAssetLibrary.load_asset(path)",
    "    if not a:",
    "        return None",
    "    act = editor.spawn_actor_from_object(a, loc)",
    "    if act:",
    "        act.set_actor_rotation(unreal.Rotator(0, yaw_deg, 0), False)",
    "        try:",
    "            act.set_actor_scale3d(scale3d)",
    "        except Exception:",
    "            pass",
    "    return act",
    "",
    "def _basename_key(path):",
    "    p = path.rstrip('/').split('/')[-1] if path else ''",
    "    if '.' in p:",
    "        p = p.split('.')[0]",
    "    return p.lower()",
    "",
    "import_dir = '/Game/GrandStudio/Imported'",
    "all_assets = unreal.EditorAssetLibrary.list_assets(import_dir, recursive=True)",
    "unreal.log(f'[placement] Recursive scan: {len(all_assets)} assets under Imported')",
    "mesh_by_key = {}",
    "for a in all_assets:",
    "    clean = a.split('.')[0]",
    "    try:",
    "        obj = unreal.EditorAssetLibrary.load_asset(clean)",
    "    except Exception:",
    "        continue",
    "    if obj and obj.get_class().get_name() == 'StaticMesh':",
    "        k = _basename_key(clean)",
    "        mesh_by_key[k] = clean",
    "        unreal.log(f'[placement] StaticMesh: {clean}')",
    "unreal.log(f'[placement] Indexed {len(mesh_by_key)} StaticMeshes')",
    "",
    "SLOT_SPECS = [",
  ];

  for (const s of slots) {
    const mk = matchKeyFromUePath(s.path).trim();
    if (!mk) continue;
    const yawDeg = ((s.yaw * 180) / Math.PI).toFixed(2);
    lines.push(
      `    {"match": '${escapePy(mk)}', "x": ${s.x.toFixed(1)}, "y": ${s.y.toFixed(1)}, "z": ${s.z.toFixed(1)}, "yaw_deg": ${yawDeg}, "sx": ${s.scale.toFixed(3)}, "sy": ${s.scale.toFixed(3)}, "sz": ${s.scale.toFixed(3)}},`,
    );
  }

  lines.push("]");
  lines.push("");
  lines.push("placed = 0");
  lines.push("for spec in SLOT_SPECS:");
  lines.push("    want = spec['match'].lower()");
  lines.push("    resolved = mesh_by_key.get(want)");
  lines.push("    if not resolved:");
  lines.push("        for k, v in mesh_by_key.items():");
  lines.push("            if want == k or want in k or k in want:");
  lines.push("                resolved = v");
  lines.push("                break");
  lines.push("    if not resolved:");
  lines.push("        unreal.log(f\"[placement] No StaticMesh matched for '{want}' (expected from relay path)\")");
  lines.push("        continue");
  lines.push("    unreal.log(f\"[placement] Spawning {resolved} for match '{want}'\")");
  lines.push(
    "    if spawn_mesh(resolved, unreal.Vector(spec['x'], spec['y'], spec['z']), spec['yaw_deg'], unreal.Vector(spec['sx'], spec['sy'], spec['sz'])):",
  );
  lines.push("        placed += 1");
  lines.push("unreal.log(f'[placement] Spawned {placed} / {len(SLOT_SPECS)} slots')");
  lines.push("");
  lines.push("# Sky + lighting");
  lines.push("try:");
  lines.push("    editor.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0))");
  lines.push("except Exception:");
  lines.push("    pass");
  lines.push("try:");
  lines.push(`    sun = editor.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(-4000, -4000, 3000))`);
  lines.push("    if sun:");
  lines.push(
    `        sun.set_actor_rotation(unreal.Rotator(${sun.pitch}, ${sun.yaw}, ${sun.roll}), False)`,
  );
  lines.push("except Exception:");
  lines.push("    pass");
  lines.push("try:");
  lines.push("    sl = editor.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 2000))");
  lines.push("    if sl:");
  lines.push("        comp = sl.get_component_by_class(unreal.SkyLightComponent)");
  lines.push("        if comp:")
  lines.push("            comp.set_editor_property('intensity', 1.2)");
  lines.push("except Exception:");
  lines.push("    pass");
  lines.push("");
  lines.push("# Overview camera");
  lines.push("try:");
  lines.push(
    `    cam = editor.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(${scaleToHalfExtent(scene.scale) * 1.2}, ${-scaleToHalfExtent(scene.scale)}, ${scaleToHalfExtent(scene.scale) * 0.35}))`,
  );
  lines.push("    if cam:");
  lines.push("        cam.set_actor_rotation(unreal.Rotator(-18, 42, 0), False)");
  lines.push("except Exception:");
  lines.push("    pass");
  lines.push("unreal.log('Scene build placement complete.')");

  return lines.join("\n");
}

function flattenSceneObjects(scene: SceneRequest): Array<{ category: SceneObjectCategory; obj: SceneObject }> {
  const out: Array<{ category: SceneObjectCategory; obj: SceneObject }> = [];
  const push = (category: SceneObjectCategory, arr: SceneObject[]) => {
    for (const o of arr) {
      if (o.count >= 1) out.push({ category, obj: o });
    }
  };
  push("buildings", scene.buildings);
  push("vegetation", scene.vegetation);
  push("vehicles", scene.vehicles);
  push("infrastructure", scene.infrastructure);
  push("details", scene.details);
  push("characters", scene.characters);
  return out;
}

const PRIORITY: SceneObjectCategory[] = [
  "buildings",
  "vegetation",
  "vehicles",
  "infrastructure",
  "details",
  "characters",
];

type FlatRow = { category: SceneObjectCategory; obj: SceneObject };

export function checkDeadline(chunkStartTime: number): boolean {
  return Date.now() - chunkStartTime >= CHUNK_DEADLINE_MS;
}

function logDeadlineCheck(chunkStartTime: number): void {
  const elapsed = Date.now() - chunkStartTime;
  const remaining = CHUNK_DEADLINE_MS - elapsed;
  const safe = elapsed < CHUNK_DEADLINE_MS;
  console.log(
    `[sceneBuild] DEADLINE CHECK: elapsed=${Math.round(elapsed / 1000)}s, remaining=${Math.round(remaining / 1000)}s, safe=${safe}`,
  );
}

function serCandidate(c: AssetCandidate): SerializedAssetCandidate {
  return {
    id: c.id,
    name: c.name,
    source: c.source,
    objectType: c.objectType,
    category: c.category,
    polyId: c.polyId,
    sketchfabUid: c.sketchfabUid,
    downloadCount: c.downloadCount,
    scanPath: c.scanPath ?? null,
  };
}

function deserCandidate(c: SerializedAssetCandidate): AssetCandidate {
  return {
    id: c.id,
    name: c.name,
    source: c.source,
    objectType: c.objectType,
    category: c.category as SceneObjectCategory,
    polyId: c.polyId,
    sketchfabUid: c.sketchfabUid,
    downloadCount: c.downloadCount,
    scanPath: c.scanPath ?? null,
  };
}

function snapshotToSearchJson(snap: SearchSnapshot): object {
  return {
    pathsReadyByType: snap.pathsReadyByType,
    candidateByKey: snap.candidateByKey,
    searchRowIndex: snap.searchRowIndex,
    rowsSerialized: snap.rowsSerialized,
  };
}

/**
 * Chunked engine: search → import → place → screenshot. Resumes via BuildSceneParams.
 */
export async function buildScene(params: BuildSceneParams): Promise<{
  outcome: BuildSceneOutcome;
  sessionId: string;
  totalElapsedMs?: number;
}> {
  const {
    sceneRequest,
    projectId,
    assetSource,
    scannedAssets,
    chunkStartTime,
    sessionId,
    progressRowId,
} = params;

  const emit = async (ev: SceneBuildProgressEvent) => {
    await params.progressCallback(ev);
  };

  const rows: FlatRow[] = flattenSceneObjects(sceneRequest);
  rows.sort((a, b) => PRIORITY.indexOf(a.category) - PRIORITY.indexOf(b.category));

  let cumulativeBase = params.cumulativeElapsedMsBase;
  const log = (msg: string) => console.log(`[sceneBuild] ${msg}`);
  const chunkElapsed0 = Date.now() - chunkStartTime;
  log(
    `CHUNK START: session=${sessionId}, resuming from phase=${params.resumePhase ?? "new"}, imported=${params.resumeImportedCount}/${params.resumeTotalImports || 0}, elapsed=${Math.round(chunkElapsed0 / 1000)}s`,
  );

  const candidateByKey = new Map<string, AssetCandidate>();
  const pathsReadyByType = new Map<string, string[]>();

  let searchRowIndex = 0;
  if (params.resumePhase === "import" || params.resumePhase === "place" || params.resumePhase === "screenshot") {
    const snap = params.resumeSearchSnapshot;
    if (snap) {
      Object.entries(snap.pathsReadyByType).forEach(([k, v]) => pathsReadyByType.set(k, [...v]));
      Object.values(snap.candidateByKey).forEach((sc) => {
        candidateByKey.set(sc.id, deserCandidate(sc));
      });
    }
  } else if (params.resumeSearchSnapshot && params.resumePhase === "search") {
    const snap = params.resumeSearchSnapshot;
    searchRowIndex = snap.searchRowIndex;
    Object.entries(snap.pathsReadyByType).forEach(([k, v]) => pathsReadyByType.set(k, [...v]));
    Object.values(snap.candidateByKey).forEach((sc) => {
      candidateByKey.set(sc.id, deserCandidate(sc));
    });
  }

  const phaseStart = params.resumePhase ?? "search";

  if (phaseStart === "search") {
    for (let ri = searchRowIndex; ri < rows.length; ri++) {
      logDeadlineCheck(chunkStartTime);
      if (checkDeadline(chunkStartTime)) {
        const snap: SearchSnapshot = {
          pathsReadyByType: Object.fromEntries(pathsReadyByType),
          candidateByKey: Object.fromEntries([...candidateByKey.entries()].map(([k, v]) => [k, serCandidate(v)])),
          searchRowIndex: ri,
          rowsSerialized: JSON.stringify(rows),
        };
        await updateAgentProgress(progressRowId, {
          phase: "search",
          search_results: snapshotToSearchJson(snap),
          cumulative_elapsed_ms: cumulativeBase + (Date.now() - chunkStartTime),
        });
        await emit({
          type: "chunk_pause",
          message: "Saving progress, will continue automatically…",
          sessionId,
        });
        return { outcome: "paused", sessionId };
      }

      const { category, obj } = rows[ri];
      const t = obj.type.toLowerCase();
      const needUnique = Math.min(5, Math.max(1, obj.count));
      let scanPaths: string[] = [];
      if (assetSource !== "library") {
        scanPaths = collectScannedForType(scannedAssets, obj.type, needUnique * 2);
      }

      let libraryHits: LibraryHit[] = [];
      if (assetSource === "my_assets") {
        await emit({
          type: "search",
          message: `Using your assets for "${obj.type}"… found ${scanPaths.length} matches`,
        });
      } else if (assetSource === "library") {
        await emit({ type: "search", message: `Searching libraries for "${obj.type}"…` });
        logDeadlineCheck(chunkStartTime);
        if (checkDeadline(chunkStartTime)) {
          const snap: SearchSnapshot = {
            pathsReadyByType: Object.fromEntries(pathsReadyByType),
            candidateByKey: Object.fromEntries([...candidateByKey.entries()].map(([k, v]) => [k, serCandidate(v)])),
            searchRowIndex: ri,
            rowsSerialized: JSON.stringify(rows),
          };
          await updateAgentProgress(progressRowId, {
            phase: "search",
            search_results: snapshotToSearchJson(snap),
            cumulative_elapsed_ms: cumulativeBase + (Date.now() - chunkStartTime),
          });
          await emit({ type: "chunk_pause", message: "Saving progress, will continue automatically…", sessionId });
          return { outcome: "paused", sessionId };
        }
        libraryHits = await searchLibrariesForType(obj.type);
        await emit({
          type: "search",
          message: `Searching for ${obj.type}… found ${libraryHits.length} options`,
        });
      } else {
        await emit({ type: "search", message: `Checking scans + libraries for "${obj.type}"…` });
        if (scanPaths.length < 2) {
          logDeadlineCheck(chunkStartTime);
          if (checkDeadline(chunkStartTime)) {
            const snap: SearchSnapshot = {
              pathsReadyByType: Object.fromEntries(pathsReadyByType),
              candidateByKey: Object.fromEntries([...candidateByKey.entries()].map(([k, v]) => [k, serCandidate(v)])),
              searchRowIndex: ri,
              rowsSerialized: JSON.stringify(rows),
            };
            await updateAgentProgress(progressRowId, {
              phase: "search",
              search_results: snapshotToSearchJson(snap),
              cumulative_elapsed_ms: cumulativeBase + (Date.now() - chunkStartTime),
            });
            await emit({ type: "chunk_pause", message: "Saving progress, will continue automatically…", sessionId });
            return { outcome: "paused", sessionId };
          }
          libraryHits = await searchLibrariesForType(obj.type);
        }
        await emit({
          type: "search",
          message: `Searching for ${obj.type}… found ${scanPaths.length} scanned + ${libraryHits.length} library options`,
        });
      }

      const chosenLib = libraryHits.slice(0, needUnique);
      for (const h of chosenLib) {
        const cand: AssetCandidate = {
          id: h.key,
          name: h.name,
          source: h.source,
          objectType: obj.type,
          category,
          polyId: h.polyId,
          sketchfabUid: h.sketchfabUid,
          downloadCount: h.downloadCount,
          scanPath: null,
        };
        candidateByKey.set(h.key, cand);
      }
      for (const p of scanPaths) {
        const key = `sc:${p}`;
        if (!candidateByKey.has(key)) {
          candidateByKey.set(key, {
            id: key,
            name: p.split("/").pop() ?? p,
            source: "scanned",
            objectType: obj.type,
            category,
            scanPath: p,
            downloadCount: 0,
          });
        }
      }
      if (!pathsReadyByType.has(t)) pathsReadyByType.set(t, []);
      const bucket = pathsReadyByType.get(t)!;
      for (const p of scanPaths) {
        if (!bucket.includes(p)) bucket.push(p);
      }
    }
  }

  const importJobs: AssetCandidate[] = [];
  for (const c of candidateByKey.values()) {
    if (c.source === "scanned" && c.scanPath) continue;
    importJobs.push(c);
  }
  const seenJob = new Set<string>();
  const dedupedJobs: AssetCandidate[] = [];
  for (const j of importJobs) {
    if (seenJob.has(j.id)) continue;
    seenJob.add(j.id);
    dedupedJobs.push(j);
  }
  const prioritized = [...dedupedJobs].sort((a, b) => {
    const pa = PRIORITY.indexOf(a.category);
    const pb = PRIORITY.indexOf(b.category);
    if (pa !== pb) return pa - pb;
    const ap = a.source === "polyhaven" ? 1 : 0;
    const bp = b.source === "polyhaven" ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return b.downloadCount - a.downloadCount;
  });

  let toImport: AssetCandidate[] = prioritized.slice(0, MAX_IMPORTS_PER_SCENE);
  if (params.resumeImportQueue.length > 0) {
    toImport = params.resumeImportQueue.map(deserCandidate);
  } else {
    await updateAgentProgress(progressRowId, {
      phase: "import",
      import_queue: toImport.map(serCandidate),
      total_imports: toImport.length,
      imported_count: params.resumeImportedCount,
      search_results: {
        pathsReadyByType: Object.fromEntries(pathsReadyByType),
        candidateByKey: Object.fromEntries([...candidateByKey.entries()].map(([k, v]) => [k, serCandidate(v)])),
        searchRowIndex: rows.length,
        rowsSerialized: JSON.stringify(rows),
      },
    });
  }

  const totalImports = toImport.length;
  let importedAssets: ImportedAssetRecord[] = [...params.resumeImportedAssets];
  let importedCount = params.resumeImportedCount;

  if (phaseStart === "import" || phaseStart === "search") {
    if (importedCount === 0) {
      if (await waitRelayWithRetries()) {
        const cleanId = await queueUE5Command(
          projectId,
          `import unreal\n${CLEAN_DOWNLOADS_PYTHON}`,
          { commandType: "execute" },
        );
        await waitForCommand(cleanId, 120_000);
      }
    }

    for (let i = importedCount; i < toImport.length; i++) {
      const elapsedChunk = Date.now() - chunkStartTime;
      const remainingChunk = CHUNK_DEADLINE_MS - elapsedChunk;
      const stopEarlyForPlacement =
        remainingChunk < PLACEMENT_TIME_RESERVE_MS ||
        (elapsedChunk > IMPORT_STOP_AFTER_ELAPSED_MS && importedCount >= 3);
      if (stopEarlyForPlacement) {
        log(
          `DEADLINE APPROACHING: skipping remaining imports, jumping to placement with ${importedCount} imported models`,
        );
        break;
      }

      logDeadlineCheck(chunkStartTime);
      if (checkDeadline(chunkStartTime)) {
        log(`CHUNK PAUSE: saving progress at import ${importedCount}/${totalImports}, will resume in next request`);
        await updateAgentProgress(progressRowId, {
          phase: "import",
          import_queue: toImport.map(serCandidate),
          imported_assets: importedAssets,
          imported_count: importedCount,
          total_imports: totalImports,
          search_results: {
            pathsReadyByType: Object.fromEntries(pathsReadyByType),
            candidateByKey: Object.fromEntries([...candidateByKey.entries()].map(([k, v]) => [k, serCandidate(v)])),
            searchRowIndex: rows.length,
            rowsSerialized: JSON.stringify(rows),
          },
          cumulative_elapsed_ms: cumulativeBase + (Date.now() - chunkStartTime),
        });
        await emit({ type: "chunk_pause", message: "Saving progress, will continue automatically…", sessionId });
        return { outcome: "paused", sessionId };
      }

      const job = toImport[i];
      const curGlobal = i + 1;
      if (!(await ensureRelayBeforeImport())) {
        await emit({
          type: "error",
          message: `Relay offline — skipping import ${curGlobal}/${totalImports} (${job.name}). Will retry placement with other assets.`,
        });
        continue;
      }

      const destName = `${job.objectType.replace(/[^a-zA-Z0-9_]/g, "_")}_${job.source}_${String(curGlobal).padStart(3, "0")}`.slice(0, 55);

      let cmdId: string | undefined;
      if (job.source === "polyhaven" && job.polyId) {
        const polyBundle = await downloadPolyHavenModel(job.polyId);
        if (!polyBundle?.meshUrl) continue;
        await emit({
          type: "importing",
          current: curGlobal,
          total: totalImports,
          name: job.name,
          source: "our library (Poly Haven)",
        });
        const filename = `${job.polyId}_${curGlobal}.fbx`;
        const diffuseExt =
          polyBundle.diffuseUrl != null && polyBundle.diffuseUrl.length > 0
            ? diffuseFileExtensionFromUrl(polyBundle.diffuseUrl)
            : "jpg";
        const diffuseFilename =
          polyBundle.diffuseUrl != null && polyBundle.diffuseUrl.length > 0
            ? `${destName}_diffuse.${diffuseExt}`
            : undefined;
        const code = generateUE5ImportCode(polyBundle.meshUrl, filename, job.name, {
          traceAssetId: job.polyId,
          destinationName: destName,
          diffuseDiskFilename: diffuseFilename,
        });
        const pair = await queueRelayDownloadThenImport(
          projectId,
          {
            kind: "polyhaven_fbx",
            url: polyBundle.meshUrl,
            filename,
            diffuseUrl: polyBundle.diffuseUrl ?? undefined,
            diffuseFilename,
          },
          code,
          {
            source_provider: "polyhaven",
            source_url: polyBundle.meshUrl,
            file_type: "fbx",
          }
        );
        cmdId = pair.importCommandId;
      } else if (job.source === "sketchfab" && job.sketchfabUid) {
        const token = process.env.SKETCHFAB_API_TOKEN;
        if (!token) continue;
        const dl = await getSketchfabDownloadUrl(job.sketchfabUid, token);
        if (!dl) continue;
        await emit({
          type: "importing",
          current: curGlobal,
          total: totalImports,
          name: job.name,
          source: "our library (Sketchfab)",
        });
        const zip = `sf_${job.sketchfabUid}_${curGlobal}.zip`;
        const importStem = `sf_${job.sketchfabUid}`;
        const code = generateSketchfabLocalImportCode(importStem, job.name, {
          traceAssetId: job.sketchfabUid,
          destinationName: destName,
        });
        const pair = await queueRelayDownloadThenImport(
          projectId,
          {
            kind: "sketchfab_zip",
            url: dl,
            filename: zip,
            importStem,
          },
          code,
          {
            source_provider: "sketchfab",
            source_url: dl,
            file_type: "zip",
          }
        );
        cmdId = pair.importCommandId;
      } else {
        continue;
      }

      if (!cmdId) continue;
      const result = await waitForCommand(cmdId);
      if (result.status !== "success") {
        await emit({ type: "error", message: `Import failed: ${job.name}` });
        continue;
      }

      const supabase = createServerClient();
      const { data: row } = await supabase
        .from("ue5_import_assets")
        .select("ue_asset_path")
        .eq("ue5_command_id", cmdId)
        .maybeSingle();
      const uePath = row?.ue_asset_path ?? `/Game/GrandStudio/Imported/${destName}`;
      importedAssets.push({
        jobId: job.id,
        path: uePath,
        objectType: job.objectType,
        category: job.category,
      });
      importedCount += 1;

      const arr = pathsReadyByType.get(job.objectType.toLowerCase()) ?? [];
      if (!arr.includes(uePath)) arr.push(uePath);
      pathsReadyByType.set(job.objectType.toLowerCase(), arr);

      await updateAgentProgress(progressRowId, {
        imported_assets: importedAssets,
        imported_count: importedCount,
        import_queue: toImport.map(serCandidate),
        total_imports: totalImports,
        cumulative_elapsed_ms: cumulativeBase + (Date.now() - chunkStartTime),
      });

      const minGapMs = isHeavyBuildingType(job.objectType) ? 35_000 : 25_000;
      await sleep(minGapMs);
      if (importedCount > 0 && importedCount % 3 === 0) await sleep(15_000);
    }
  }

  const pathsBySlot: Array<{ category: SceneObjectCategory; objectType: string; path: string }> = [];
  for (const { category, obj } of rows) {
    const t = obj.type.toLowerCase();
    const pool = [...(pathsReadyByType.get(t) ?? [])];
    if (pool.length === 0) continue;
    for (let k = 0; k < obj.count; k++) {
      const path = pool[k % pool.length];
      pathsBySlot.push({ category, objectType: obj.type, path });
    }
  }

  if (pathsBySlot.length === 0) {
    await emit({ type: "error", message: "No assets available to place." });
    await emit({ type: "complete", summary: "Build aborted — no models imported or scanned." });
    await updateAgentProgress(progressRowId, { status: "error", error_message: "No assets to place" });
    return { outcome: "error", sessionId };
  }

  const runPlacement = params.resumePhase !== "screenshot" && !params.resumePlacementDone;
  if (runPlacement) {
    logDeadlineCheck(chunkStartTime);
    if (checkDeadline(chunkStartTime)) {
      await updateAgentProgress(progressRowId, {
        phase: "place",
        placement_done: false,
        screenshot_done: false,
        cumulative_elapsed_ms: cumulativeBase + (Date.now() - chunkStartTime),
      });
      await emit({ type: "chunk_pause", message: "Saving progress, will continue automatically…", sessionId });
      return { outcome: "paused", sessionId };
    }
    await emit({ type: "placing", message: `Placing ${pathsBySlot.length} objects in your scene…` });
    const slots = computeSlots(sceneRequest, pathsBySlot);
    const py = generatePlacementCode(sceneRequest, slots);
    if (await waitRelayWithRetries()) {
      const placeId = await queueUE5Command(projectId, py, { commandType: "execute" });
      await waitForCommand(placeId, 600000);
      await sleep(10000);
    }
    await updateAgentProgress(progressRowId, { placement_done: true, phase: "screenshot" });
  }

  if (!params.resumeScreenshotDone) {
    logDeadlineCheck(chunkStartTime);
    if (checkDeadline(chunkStartTime)) {
      await updateAgentProgress(progressRowId, {
        phase: "screenshot",
        cumulative_elapsed_ms: cumulativeBase + (Date.now() - chunkStartTime),
      });
      await emit({ type: "chunk_pause", message: "Saving progress, will continue automatically…", sessionId });
      return { outcome: "paused", sessionId };
    }
    if (await waitRelayWithRetries()) {
      const sid = await queueUE5Command(projectId, " ", { commandType: "screenshot" });
      await waitForCommand(sid, 120000);
      await sleep(5000);
    }
    await updateAgentProgress(progressRowId, { screenshot_done: true });
  }

  const totalMs = cumulativeBase + (Date.now() - chunkStartTime);
  const counts = rows.map((r) => `${r.obj.count} ${r.obj.type}`).join(", ");
  log(
    `AGENT COMPLETE: all ${totalImports} imports done, placement done, total time across chunks ≈ ${Math.round(totalMs / 1000)}s (this chunk ≈ ${Math.round((Date.now() - chunkStartTime) / 1000)}s)`,
  );
  await emit({
    type: "complete",
    summary: `${sceneRequest.scene_type} built! ${counts}. (${pathsBySlot.length} instances placed.) Total time ≈ ${Math.round(totalMs / 1000)}s.`,
  });
  await updateAgentProgress(progressRowId, {
    status: "completed",
    phase: "completed",
    placement_done: true,
    screenshot_done: true,
    cumulative_elapsed_ms: totalMs,
  });
  return { outcome: "completed", sessionId, totalElapsedMs: totalMs };
}
