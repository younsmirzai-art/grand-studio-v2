import { getPolyHavenModelImportUrls } from "@/lib/polyhaven/client";
import { searchModels as searchSketchfab, getDownloadUrl as getSketchfabDownloadUrl } from "@/lib/sketchfab/client";
import { queueRelayDownloadCommand } from "@/lib/ue5/commands";
import {
  diffuseFileExtensionFromUrl,
  generateSketchfabLocalImportCode,
  generateUE5ImportCode,
} from "@/lib/ue5/importCode";
import type { RelayDownloadContext } from "@/lib/ue5/relayDownload";
import { waitForUE5CommandStatus } from "@/lib/ue5/relayDownload";

const POLYHAVEN_RE = /\[POLYHAVEN_IMPORT:\s*([^\]]+)\]/g;
const SKETCHFAB_RE = /\[SKETCHFAB_IMPORT:\s*([^\]]+)\]/g;

export interface AssetImportRequest {
  source: "polyhaven" | "sketchfab";
  assetId: string;
  type?: string;
  position?: string;
  scale?: string;
  label?: string;
  query?: string;
}

export interface ResolvedAssets {
  imports: AssetImportRequest[];
  importCode: string;
}

function meshExtensionFromDownloadUrl(url: string): string {
  const path = url.split("?")[0].split("#")[0].toLowerCase();
  if (path.endsWith(".glb")) return "glb";
  if (path.endsWith(".fbx")) return "fbx";
  return "fbx";
}

export function parseImportTags(aiResponse: string): AssetImportRequest[] {
  const imports: AssetImportRequest[] = [];

  let match;
  while ((match = POLYHAVEN_RE.exec(aiResponse)) !== null) {
    const parts = match[1].split("|").map((s) => s.trim());
    imports.push({
      source: "polyhaven",
      assetId: parts[0] ?? "",
      type: parts[1] ?? "model",
      position: parts[2] ?? "0,0,0",
      scale: parts[3] ?? "1",
      label: parts[4] ?? "PHAsset",
    });
  }

  while ((match = SKETCHFAB_RE.exec(aiResponse)) !== null) {
    const parts = match[1].split("|").map((s) => s.trim());
    imports.push({
      source: "sketchfab",
      query: parts[0] ?? "",
      assetId: "",
      position: parts[1] ?? "0,0,0",
      scale: parts[2] ?? "1",
      label: parts[3] ?? "SFAsset",
    });
  }

  return imports;
}

function stripLeadingImportUnreal(code: string): string {
  return code.replace(/^import unreal\n/, "");
}

/** Wrap UE import snippets in try/except; indent under try. */
export function combineLocalImportFragments(fragments: string[]): string {
  if (fragments.length === 0) return "";
  let out = "# --- Asset imports (files pre-downloaded by relay) ---\n";
  for (let i = 0; i < fragments.length; i++) {
    let frag = fragments[i].trimEnd();
    if (i > 0) frag = stripLeadingImportUnreal(frag);
    const lines = frag.split("\n");
    out += "try:\n";
    for (const line of lines) {
      if (line.trim() === "") out += "\n";
      else out += `    ${line}\n`;
    }
    out += "except Exception as _gs_e:\n";
    out += "    unreal.log_warning(f'Import failed: {_gs_e}')\n\n";
  }
  return out;
}

export function combineCodeWithImports(
  originalPython: string,
  importCode: string
): string {
  if (!importCode) return originalPython;

  const importIdx = originalPython.indexOf("import unreal");
  if (importIdx >= 0) {
    const afterImport = originalPython.indexOf("\n", importIdx);
    if (afterImport >= 0) {
      return (
        originalPython.slice(0, afterImport + 1) +
        "\n" +
        importCode +
        "\n" +
        originalPython.slice(afterImport + 1)
      );
    }
  }

  return importCode + "\n\n" + originalPython;
}

export function stripImportTags(response: string): string {
  return response
    .replace(POLYHAVEN_RE, "")
    .replace(SKETCHFAB_RE, "")
    .trim();
}

/**
 * Resolves import tags, queues relay download(s), waits, then returns UE5 import code
 * that only reads local files (no urllib in UE5).
 */
export async function resolveAssets(
  aiResponse: string,
  projectId?: string
): Promise<ResolvedAssets> {
  const imports = parseImportTags(aiResponse);
  if (imports.length === 0) return { imports: [], importCode: "" };

  const storageUrls = new Map<string, string>();
  const polyDiffuseByAssetId = new Map<string, string | null>();
  const sketchfabUidByQuery = new Map<string, string>();

  const sfToken = process.env.SKETCHFAB_API_TOKEN ?? "";

  await Promise.all(
    imports.map(async (imp) => {
      try {
        if (imp.source === "polyhaven") {
          const bundle = await getPolyHavenModelImportUrls(imp.assetId);
          if (bundle?.meshUrl) {
            storageUrls.set(imp.assetId, bundle.meshUrl);
            polyDiffuseByAssetId.set(imp.assetId, bundle.diffuseUrl);
          }
        } else if (imp.source === "sketchfab" && imp.query) {
          const results = await searchSketchfab(imp.query, {
            count: 1,
            token: sfToken,
          });
          if (results.length > 0 && sfToken) {
            const uid = results[0].uid;
            const dlUrl = await getSketchfabDownloadUrl(uid, sfToken);
            if (dlUrl) {
              storageUrls.set(imp.query, dlUrl);
              sketchfabUidByQuery.set(imp.query, uid);
            }
          }
        }
      } catch (e) {
        console.warn(`[AssetResolver] Failed to resolve ${imp.source}`, e);
      }
    })
  );

  if (!projectId) {
    console.warn("[AssetResolver] No projectId — skipping relay downloads; no import code emitted");
    return { imports, importCode: "" };
  }

  const downloadJobs: RelayDownloadContext[] = [];
  const fragments: string[] = [];

  for (const imp of imports) {
    if (imp.source === "polyhaven") {
      const url = storageUrls.get(imp.assetId);
      if (!url) continue;
      const destName =
        (imp.label ?? imp.assetId).replace(/[^a-zA-Z0-9_]/g, "_") || "imported_mesh";
      const filename = `${imp.assetId.replace(/[^a-zA-Z0-9_-]/g, "_")}.fbx`;
      const polyDiffuse = polyDiffuseByAssetId.get(imp.assetId) ?? null;
      const diffuseExt =
        polyDiffuse != null && polyDiffuse.length > 0
          ? diffuseFileExtensionFromUrl(polyDiffuse)
          : "jpg";
      const diffuseFilename =
        polyDiffuse != null && polyDiffuse.length > 0
          ? `${destName.replace(/[^a-zA-Z0-9_]/g, "_")}_diffuse.${diffuseExt}`
          : undefined;
      downloadJobs.push({
        kind: "polyhaven_fbx",
        url,
        filename,
        diffuseUrl: polyDiffuse ?? undefined,
        diffuseFilename,
      });
      fragments.push(
        generateUE5ImportCode(url, filename, imp.label ?? imp.assetId, {
          traceAssetId: imp.assetId,
          destinationName: destName,
          diffuseDiskFilename: diffuseFilename,
        })
      );
    } else if (imp.source === "sketchfab" && imp.query) {
      const url = storageUrls.get(imp.query);
      const uid = sketchfabUidByQuery.get(imp.query);
      if (!url || !uid) continue;
      const importStem = `sf_${uid}`;
      downloadJobs.push({
        kind: "sketchfab_zip",
        url,
        filename: `${uid}.zip`,
        importStem,
      });
      fragments.push(
        generateSketchfabLocalImportCode(importStem, imp.label ?? "SF", {
          traceAssetId: uid,
          destinationName: importStem,
        })
      );
    }
  }

  if (downloadJobs.length === 0) return { imports, importCode: "" };

  const downloadIds: string[] = [];
  try {
    for (const job of downloadJobs) {
      downloadIds.push(await queueRelayDownloadCommand(projectId, job));
    }
    for (const id of downloadIds) {
      const st = await waitForUE5CommandStatus(id, 600_000);
      if (st !== "success") {
        console.warn("[AssetResolver] Relay download did not succeed:", id, st);
        return { imports, importCode: "" };
      }
    }
  } catch (e) {
    console.warn("[AssetResolver] Relay download queue failed:", e);
    return { imports, importCode: "" };
  }

  const importCode = combineLocalImportFragments(fragments);
  return { imports, importCode };
}
