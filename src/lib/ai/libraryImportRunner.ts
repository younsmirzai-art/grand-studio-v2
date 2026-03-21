/**
 * Agent library imports: search (via internal API fetch) → download → generateUE5ImportCode → queue UE5.
 * Uses the same behavior as /api/polyhaven/search, downloadPolyHavenModelToStorage, Sketchfab client, etc.
 */

import { createServerClient } from "@/lib/supabase/server";
import { queueUE5Command } from "@/lib/ue5/commands";
import { getInternalSiteUrl } from "@/lib/site/internalUrl";
import { isRelayOnline } from "@/lib/ue5/relayStatus";
import { searchAssets as searchPolyhavenDirect, type PolyHavenAsset } from "@/lib/polyhaven/client";
import { downloadPolyHavenModelToStorage } from "@/lib/polyhaven/downloadToSupabase";
import { searchModels as searchSketchfabDirect, getDownloadUrl } from "@/lib/sketchfab/client";
import { generateUE5ImportCode, generateSketchfabImportCode } from "@/lib/ue5/importCode";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";
import type { ImportProgressEvent } from "@/lib/ai/agentImportTypes";
import { pickQueriesForAction } from "@/lib/ai/assetResolver2-queries";

const WAIT_AFTER_NORMAL_MS = 8000;
const WAIT_AFTER_BUILDING_MS = 20000;
const WAIT_STABILIZE_EVERY_5_MS = 15000;
export const MAX_IMPORTS_PER_STEP = 5;
export const MAX_IMPORTS_PER_SCENE = 25;

async function waitForCommand(
  commandId: string,
  timeoutMs = 180000
): Promise<{ status: string }> {
  const supabase = createServerClient();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await supabase
      .from("ue5_commands")
      .select("status")
      .eq("id", commandId)
      .maybeSingle();
    if (data?.status === "success" || data?.status === "error") {
      return { status: data.status };
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { status: "timeout" };
}

async function fetchPolyhavenSearchHttp(query: string, count: number): Promise<PolyHavenAsset[]> {
  const base = getInternalSiteUrl();
  const url = `${base}/api/polyhaven/search`;
  console.log(`AGENT: Searching Poly Haven for: ${query} (POST ${url})`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, type: "models", count }),
  });
  if (!res.ok) {
    console.warn(`AGENT: Poly Haven search HTTP ${res.status}, falling back to direct client`);
    return searchPolyhavenDirect(query, "models", count);
  }
  const data = (await res.json()) as { results?: PolyHavenAsset[] };
  const results = data.results ?? [];
  console.log(`AGENT: Poly Haven returned N results: ${results.length}`);
  return results;
}

async function fetchSketchfabSearchHttp(query: string, count: number): Promise<{
  uid: string;
  name: string;
}[]> {
  const base = getInternalSiteUrl();
  const url = `${base}/api/sketchfab/search`;
  console.log(`AGENT: Searching Sketchfab for: ${query} (POST ${url})`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, count }),
  });
  if (!res.ok) {
    console.warn(`AGENT: Sketchfab search HTTP ${res.status}, falling back to direct client`);
    const token = process.env.SKETCHFAB_API_TOKEN;
    const results = await searchSketchfabDirect(query, { count, token: token ?? undefined });
    return results.map((r) => ({ uid: r.uid, name: r.name }));
  }
  const data = (await res.json()) as { results?: { uid: string; name: string }[] };
  const results = data.results ?? [];
  console.log(`AGENT: Sketchfab returned N results: ${results.length}`);
  return results;
}

function isBuildingStep(action: string): boolean {
  return action.toLowerCase() === "place_buildings";
}

export type RunLibraryImportArgs = {
  action: string;
  userPrompt: string;
  projectId: string;
  userId: string;
  stepNumber: number;
  count: number;
  onProgress?: (ev: ImportProgressEvent) => void | Promise<void>;
  /** Global successful imports this scene; updated in-place. */
  sceneImportTotal: { value: number };
};

/**
 * Import up to `count` assets (capped at MAX_IMPORTS_PER_STEP), never exceeding MAX_IMPORTS_PER_SCENE.
 */
export async function runSequentialLibraryImports(args: RunLibraryImportArgs): Promise<{
  paths: string[];
  imported: number;
}> {
  const { action, userPrompt, projectId, userId, stepNumber, onProgress, sceneImportTotal } = args;
  let count = Math.min(args.count, MAX_IMPORTS_PER_STEP, Math.max(0, MAX_IMPORTS_PER_SCENE - sceneImportTotal.value));
  if (count <= 0) {
    console.log(`AGENT: Skipping library import for step ${stepNumber} — global cap reached or count 0`);
    return { paths: [], imported: 0 };
  }

  console.log(
    `AGENT: Starting library import for step ${stepNumber}, need ${count} assets of type ${action}`
  );

  const paths: string[] = [];
  const supabase = createServerClient();
  let imported = 0;
  const usedPolyIds = new Set<string>();
  const usedSfUids = new Set<string>();

  for (let i = 0; i < count; i++) {
    if (sceneImportTotal.value >= MAX_IMPORTS_PER_SCENE) {
      console.log(`AGENT: Stopping imports — reached MAX_IMPORTS_PER_SCENE (${MAX_IMPORTS_PER_SCENE})`);
      break;
    }

    const relayOk = await isRelayOnline();
    if (!relayOk) {
      console.warn("AGENT: Relay not connected — aborting library imports until UE5 relay is online");
      await onProgress?.({
        asset: "(relay offline)",
        source: "none",
        current: i + 1,
        total: count,
      });
      break;
    }

    const { poly, sketchfab } = pickQueriesForAction(action, userPrompt, i + stepNumber * 100);

    let polyLimit = await checkUsageLimit(userId, "polyhaven_import");
    let sfLimit = await checkUsageLimit(userId, "sketchfab_import");

    let doneThisRound = false;

    if (polyLimit.allowed) {
      const results = await fetchPolyhavenSearchHttp(poly, 20);
      let pick: PolyHavenAsset | undefined;
      for (const r of results) {
        if (r?.id && !usedPolyIds.has(r.id)) {
          pick = r;
          break;
        }
      }
      if (!pick && results[0]?.id) pick = results[0];
      if (pick?.id) {
        console.log(`AGENT: Downloading asset: ${pick.name} from polyhaven`, pick.id);
        const storageUrl = await downloadPolyHavenModelToStorage(pick.id);
        if (storageUrl) {
          usedPolyIds.add(pick.id);
          await recordUsage(userId, "polyhaven_import");
          const ext = storageUrl.endsWith(".glb") ? "glb" : storageUrl.endsWith(".fbx") ? "fbx" : "gltf";
          const label = pick.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
          const filename = `${label}.${ext}`;
          const importCode = generateUE5ImportCode(storageUrl, filename, label);
          console.log(`AGENT: Import command queued for asset: ${pick.name}`);
          const commandId = await queueUE5Command(projectId, importCode, { commandType: "import" });
          await onProgress?.({
            asset: pick.name,
            source: "polyhaven",
            current: i + 1,
            total: count,
          });
          const done = await waitForCommand(commandId, 180000);
          if (done.status === "success") {
            imported += 1;
            sceneImportTotal.value += 1;
            const { data: importRow } = await supabase
              .from("ue5_import_assets")
              .select("ue_asset_path")
              .eq("ue5_command_id", commandId)
              .maybeSingle();
            if (importRow?.ue_asset_path && typeof importRow.ue_asset_path === "string") {
              paths.push(importRow.ue_asset_path);
            }
          }
          doneThisRound = true;
          const waitMs = isBuildingStep(action) ? WAIT_AFTER_BUILDING_MS : WAIT_AFTER_NORMAL_MS;
          console.log(`AGENT: Waiting ${waitMs / 1000} seconds for UE5 to process`);
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
    }

    if (!doneThisRound && sfLimit.allowed && process.env.SKETCHFAB_API_TOKEN) {
      const results = await fetchSketchfabSearchHttp(sketchfab, 12);
      let pick: { uid: string; name: string } | undefined;
      for (const r of results) {
        if (r?.uid && !usedSfUids.has(r.uid)) {
          pick = r;
          break;
        }
      }
      if (!pick && results[0]?.uid) pick = results[0];
      if (pick?.uid) {
        usedSfUids.add(pick.uid);
        console.log(`AGENT: Downloading asset: ${pick.name} from sketchfab`);
        const downloadUrl = await getDownloadUrl(pick.uid, process.env.SKETCHFAB_API_TOKEN);
        if (downloadUrl) {
          await recordUsage(userId, "sketchfab_import");
          const label = pick.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
          const importCode = generateSketchfabImportCode(downloadUrl, `${pick.uid}.zip`, label);
          console.log(`AGENT: Import command queued for asset: ${pick.name}`);
          const commandId = await queueUE5Command(projectId, importCode, { commandType: "import" });
          await onProgress?.({
            asset: pick.name,
            source: "sketchfab",
            current: i + 1,
            total: count,
          });
          const done = await waitForCommand(commandId, 180000);
          if (done.status === "success") {
            imported += 1;
            sceneImportTotal.value += 1;
            const { data: importRow } = await supabase
              .from("ue5_import_assets")
              .select("ue_asset_path")
              .eq("ue5_command_id", commandId)
              .maybeSingle();
            if (importRow?.ue_asset_path && typeof importRow.ue_asset_path === "string") {
              paths.push(importRow.ue_asset_path);
            }
          }
          doneThisRound = true;
          const waitMs = isBuildingStep(action) ? WAIT_AFTER_BUILDING_MS : WAIT_AFTER_NORMAL_MS;
          console.log(`AGENT: Waiting ${waitMs / 1000} seconds for UE5 to process`);
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
    }

    if (!doneThisRound) {
      await onProgress?.({
        asset: poly,
        source: "none",
        current: i + 1,
        total: count,
      });
      console.log(`AGENT: No library import succeeded for slot ${i + 1}`);
      await new Promise((r) => setTimeout(r, WAIT_AFTER_NORMAL_MS));
    }

    if (sceneImportTotal.value > 0 && sceneImportTotal.value % 5 === 0) {
      console.log("AGENT: Waiting 15 seconds for UE5 to stabilize (after every 5 imports)");
      await new Promise((r) => setTimeout(r, WAIT_STABILIZE_EVERY_5_MS));
    }
  }

  console.log(
    `AGENT: Finished library import for step ${stepNumber} — imported ${imported}, paths ${paths.length}`
  );
  return { paths, imported };
}
