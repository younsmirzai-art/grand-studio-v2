import { createServerClient } from "@/lib/supabase/server";
import { queueUE5Command } from "@/lib/ue5/commands";
import { generateUE5ImportCode, generateSketchfabImportCode } from "@/lib/ue5/importCode";
import { searchAssets as searchPolyHaven } from "@/lib/polyhaven/client";
import { downloadPolyHavenModelToStorage as downloadPolyHavenModel } from "@/lib/polyhaven/downloadToSupabase";
import { searchModels as searchSketchfab, getDownloadUrl as getSketchfabDownloadUrl } from "@/lib/sketchfab/client";
import { isRelayOnline } from "@/lib/ue5/relayStatus";
import type { SceneRequest, SceneObject, SceneObjectCategory } from "@/lib/ai/sceneSchema";

export type AssetSourceMode = "my_assets" | "library" | "both";

type ScannedAsset = { path?: string; name?: string; type?: string };

export type SceneBuildProgressEvent =
  | { type: "plan"; sceneRequest: SceneRequest }
  | { type: "search"; message: string }
  | { type: "importing"; current: number; total: number; name: string; source: string }
  | { type: "placing"; message: string }
  | { type: "complete"; summary: string }
  | { type: "error"; message: string };

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

const NATURE_TYPES = new Set([
  "tree",
  "pine",
  "palm",
  "cactus",
  "bush",
  "rock",
]);

const MAX_IMPORTS_PER_SCENE = 25;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const preferNature = NATURE_TYPES.has(objectType.toLowerCase());

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

  const list = [...bucket.values()];
  list.sort((a, b) => {
    const ap = a.source === "polyhaven" ? 1 : 0;
    const bp = b.source === "polyhaven" ? 1 : 0;
    if (preferNature) {
      if (ap !== bp) return bp - ap;
    } else {
      if (ap !== bp) return ap - bp;
    }
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
      sc = rand(0.85, 1.15);
      yaw = rand(0, 360) * (Math.PI / 180);
    } else if (row.category === "vehicles") {
      const i = vi++;
      x = i * 500 - nv * 250;
      y = -half * 0.55;
      yaw = rand(-0.08, 0.08);
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
  ];

  for (const s of slots) {
    const p = escapePy(s.path);
    lines.push(
      `spawn_mesh('${p}', unreal.Vector(${s.x.toFixed(1)}, ${s.y.toFixed(1)}, ${s.z.toFixed(1)}), ${((s.yaw * 180) / Math.PI).toFixed(2)}, unreal.Vector(${s.scale.toFixed(3)}, ${s.scale.toFixed(3)}, ${s.scale.toFixed(3)}))`,
    );
  }

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

/**
 * Main engine: search → import → place → screenshot. No AI calls.
 */
export async function buildScene(
  sceneRequest: SceneRequest,
  projectId: string,
  _userId: string,
  assetSource: AssetSourceMode,
  scannedAssets: ScannedAsset[],
  progressCallback: (ev: SceneBuildProgressEvent) => void | Promise<void>,
): Promise<void> {
  const emit = async (ev: SceneBuildProgressEvent) => {
    await progressCallback(ev);
  };

  const rows = flattenSceneObjects(sceneRequest);
  rows.sort((a, b) => PRIORITY.indexOf(a.category) - PRIORITY.indexOf(b.category));

  const candidateByKey = new Map<string, AssetCandidate>();
  const pathsReadyByType = new Map<string, string[]>();

  for (const { category, obj } of rows) {
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
      await emit({
        type: "search",
        message: `Searching libraries for "${obj.type}"…`,
      });
      libraryHits = await searchLibrariesForType(obj.type);
      await emit({
        type: "search",
        message: `Searching for ${obj.type}… found ${libraryHits.length} options`,
      });
    } else {
      await emit({
        type: "search",
        message: `Checking scans + libraries for "${obj.type}"…`,
      });
      if (scanPaths.length < 2) {
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
      if (h.source === "polyhaven" && h.polyId) {
        cand.downloadUrl = null;
      }
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
    return b.downloadCount - a.downloadCount;
  });

  const toImport = prioritized.slice(0, MAX_IMPORTS_PER_SCENE);
  const totalImports = toImport.length;
  let queuedImports = 0;
  const pathByJobId = new Map<string, string>();

  for (let i = 0; i < toImport.length; i++) {
    const job = toImport[i];
    const cur = i + 1;

    if (!(await waitRelayWithRetries())) {
      await emit({ type: "error", message: "Relay disconnected; stopping imports." });
      break;
    }

    const destName = `${job.objectType.replace(/[^a-zA-Z0-9_]/g, "_")}_${job.source}_${String(cur).padStart(2, "0")}`.slice(0, 55);

    let cmdId: string | undefined;
    if (job.source === "polyhaven" && job.polyId) {
      const url = await downloadPolyHavenModel(job.polyId);
      if (!url) continue;
      await emit({
        type: "importing",
        current: cur,
        total: totalImports,
        name: job.name,
        source: "our library (Poly Haven)",
      });
      const ext = url.toLowerCase().includes(".fbx") ? "fbx" : "glb";
      const filename = `${job.polyId}_${cur}.${ext}`;
      const code = generateUE5ImportCode(url, filename, job.name, {
        destinationName: destName,
        replaceExisting: false,
        skipSpawnActor: true,
      });
      cmdId = await queueUE5Command(projectId, code, { commandType: "import" });
    } else if (job.source === "sketchfab" && job.sketchfabUid) {
      const token = process.env.SKETCHFAB_API_TOKEN;
      if (!token) continue;
      const dl = await getSketchfabDownloadUrl(job.sketchfabUid, token);
      if (!dl) continue;
      await emit({
        type: "importing",
        current: cur,
        total: totalImports,
        name: job.name,
        source: "our library (Sketchfab)",
      });
      const zip = `sf_${job.sketchfabUid}_${cur}.zip`;
      const code = generateSketchfabImportCode(dl, zip, job.name, {
        destinationName: destName,
        replaceExisting: false,
        skipSpawnActor: true,
      });
      cmdId = await queueUE5Command(projectId, code, { commandType: "import" });
    } else {
      continue;
    }

    if (!cmdId) continue;
    queuedImports += 1;
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
    pathByJobId.set(job.id, uePath);

    const arr = pathsReadyByType.get(job.objectType.toLowerCase()) ?? [];
    if (!arr.includes(uePath)) arr.push(uePath);
    pathsReadyByType.set(job.objectType.toLowerCase(), arr);

    const baseWait = isHeavyBuildingType(job.objectType) ? 20000 : 10000;
    await sleep(baseWait);
    if (queuedImports % 3 === 0) {
      await sleep(15000);
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
    return;
  }

  await emit({
    type: "placing",
    message: `Placing ${pathsBySlot.length} objects in your scene…`,
  });

  const slots = computeSlots(sceneRequest, pathsBySlot);
  const py = generatePlacementCode(sceneRequest, slots);

  if (await waitRelayWithRetries()) {
    const placeId = await queueUE5Command(projectId, py, { commandType: "execute" });
    await waitForCommand(placeId, 600000);
    await sleep(10000);
  }

  if (await waitRelayWithRetries()) {
    const sid = await queueUE5Command(projectId, " ", { commandType: "screenshot" });
    await waitForCommand(sid, 120000);
    await sleep(5000);
  }

  const counts = rows.map((r) => `${r.obj.count} ${r.obj.type}`).join(", ");
  await emit({
    type: "complete",
    summary: `${sceneRequest.scene_type} built! ${counts}. (${pathsBySlot.length} instances placed.)`,
  });
}
