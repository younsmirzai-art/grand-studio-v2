/**
 * Agent library imports: search (via internal API fetch) → download → generateUE5ImportCode → queue UE5.
 * Uses the same behavior as /api/polyhaven/search, downloadPolyHavenModelToStorage, Sketchfab client, etc.
 */

import { createServerClient } from "@/lib/supabase/server";
import {
  queueRelayDownloadThenImport,
  queueUE5Command,
  type ImportContext,
} from "@/lib/ue5/commands";
import { getInternalSiteUrl } from "@/lib/site/internalUrl";
import { isRelayOnline } from "@/lib/ue5/relayStatus";
import { searchAssets as searchPolyhavenDirect, type PolyHavenAsset } from "@/lib/polyhaven/client";
import { searchModels as searchSketchfabDirect } from "@/lib/sketchfab/client";
import { generateSketchfabLocalImportCode, generateUE5ImportCode } from "@/lib/ue5/importCode";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";
import type { ImportProgressEvent } from "@/lib/ai/agentImportTypes";
import { pickQueriesForAction } from "@/lib/ai/assetResolver2-queries";
import type { RelayDownloadContext } from "@/lib/ue5/relayDownload";

const WAIT_AFTER_NORMAL_MS = 10000;
const WAIT_AFTER_BUILDING_MS = 20000;
const WAIT_STABILIZE_EVERY_5_MS = 15000;
const RELAY_RETRY_MS = 15000;
const RELAY_MAX_RETRIES = 10;
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

async function waitForRelayOrTimeout(): Promise<boolean> {
  for (let i = 0; i < RELAY_MAX_RETRIES; i++) {
    if (await isRelayOnline()) return true;
    await new Promise((r) => setTimeout(r, RELAY_RETRY_MS));
  }
  return false;
}

async function queueWithRelayCheck(projectId: string, code: string, commandType: "import" | "scan_assets" = "import"): Promise<string | null> {
  const relayReady = await waitForRelayOrTimeout();
  if (!relayReady) {
    console.warn("IMPORT: Relay disconnected after retries; skipping command queue");
    return null;
  }
  return queueUE5Command(projectId, code, { commandType });
}

async function queueRelayImportWithCheck(
  projectId: string,
  download: RelayDownloadContext,
  importCode: string,
  importCtx: ImportContext
): Promise<string | null> {
  const relayReady = await waitForRelayOrTimeout();
  if (!relayReady) {
    console.warn("IMPORT: Relay disconnected after retries; skipping relay import");
    return null;
  }
  const { importCommandId } = await queueRelayDownloadThenImport(
    projectId,
    download,
    importCode,
    importCtx
  );
  return importCommandId;
}

async function fetchPolyhavenSearchHttp(query: string, count: number): Promise<PolyHavenAsset[]> {
  const base = getInternalSiteUrl();
  const url = `${base}/api/polyhaven/search?q=${encodeURIComponent(query)}&type=models&count=${count}`;
  console.log(`IMPORT: Calling Poly Haven search API for: ${query}`);
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    console.warn(`IMPORT: Poly Haven search HTTP ${res.status}, falling back to direct client`);
    return searchPolyhavenDirect(query, "models", count);
  }
  const data = (await res.json()) as { results?: PolyHavenAsset[] };
  const results = data.results ?? [];
  console.log(`IMPORT: Poly Haven returned ${results.length} results`);
  return results;
}

async function fetchSketchfabSearchHttp(query: string, count: number): Promise<{
  uid: string;
  name: string;
}[]> {
  const base = getInternalSiteUrl();
  const url = `${base}/api/sketchfab/search`;
  console.log(`IMPORT: Calling Sketchfab search API for: ${query}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, count }),
  });
  if (!res.ok) {
    console.warn(`IMPORT: Sketchfab search HTTP ${res.status}, falling back to direct client`);
    const token = process.env.SKETCHFAB_API_TOKEN;
    const results = await searchSketchfabDirect(query, { count, token: token ?? undefined });
    return results.map((r) => ({ uid: r.uid, name: r.name }));
  }
  const data = (await res.json()) as { results?: { uid: string; name: string }[] };
  const results = data.results ?? [];
  console.log(`IMPORT: Sketchfab returned ${results.length} results`);
  return results;
}

async function fetchPolyhavenDownloadUrl(
  assetId: string,
  projectId: string
): Promise<{ url: string; diffuseUrl: string | null } | null> {
  const base = getInternalSiteUrl();
  const url = `${base}/api/polyhaven/download`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetId, type: "model", projectId }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string; diffuseUrl?: string | null };
  if (!data.url) return null;
  const diffuseUrl = typeof data.diffuseUrl === "string" && data.diffuseUrl.length > 0 ? data.diffuseUrl : null;
  return { url: data.url, diffuseUrl };
}

async function fetchSketchfabDownloadUrl(uid: string, projectId: string): Promise<string | null> {
  const base = getInternalSiteUrl();
  const url = `${base}/api/sketchfab/download`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, projectId }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
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
  console.log("AGENT LOOP: About to call library import runner (legacy path)");
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

    const relayOk = await waitForRelayOrTimeout();
    if (!relayOk) {
      console.warn("IMPORT: Relay not connected — skipping import after retries");
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
        console.log(`IMPORT: Downloading model: ${pick.name} from Poly Haven`);
        const polyDl = await fetchPolyhavenDownloadUrl(pick.id, projectId);
        if (polyDl) {
          usedPolyIds.add(pick.id);
          await recordUsage(userId, "polyhaven_import");
          const label = pick.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
          const filename = `${label}.fbx`;
          const destName = pick.id.replace(/[^a-zA-Z0-9_]/g, "_");
          const importCode = generateUE5ImportCode(polyDl.url, filename, label, {
            traceAssetId: pick.id,
            destinationName: destName,
          });
          const commandId = await queueRelayImportWithCheck(
            projectId,
            {
              kind: "polyhaven_fbx",
              url: polyDl.url,
              filename,
            },
            importCode,
            {
              source_provider: "polyhaven",
              source_url: polyDl.url,
              file_type: "fbx",
            }
          );
          if (!commandId) continue;
          console.log("IMPORT: UE5 import code generated and queued");
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
          console.log(`IMPORT: Waiting ${waitMs / 1000} seconds for UE5`);
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
        console.log(`IMPORT: Downloading model: ${pick.name} from Sketchfab`);
        const downloadUrl = await fetchSketchfabDownloadUrl(pick.uid, projectId);
        if (downloadUrl) {
          usedSfUids.add(pick.uid);
          await recordUsage(userId, "sketchfab_import");
          const label = pick.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
          const importStem = `sf_${pick.uid}`;
          const importCode = generateSketchfabLocalImportCode(importStem, label, {
            traceAssetId: pick.uid,
            destinationName: importStem,
          });
          const commandId = await queueRelayImportWithCheck(
            projectId,
            {
              kind: "sketchfab_zip",
              url: downloadUrl,
              filename: `${pick.uid}.zip`,
              importStem,
            },
            importCode,
            {
              source_provider: "sketchfab",
              source_url: downloadUrl,
              file_type: "zip",
            }
          );
          if (!commandId) continue;
          console.log("IMPORT: UE5 import code generated and queued");
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
          console.log(`IMPORT: Waiting ${waitMs / 1000} seconds for UE5`);
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
