import { getModelDownloadUrl } from "@/lib/polyhaven/client";
import { searchModels as searchSketchfab, getDownloadUrl as getSketchfabDownloadUrl } from "@/lib/sketchfab/client";
import { UE5_IMPORT_DESTINATION_PATH } from "@/lib/ue5/importCode";

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

export function generateImportPython(
  imports: AssetImportRequest[],
  storageUrls: Map<string, string>
): string {
  if (imports.length === 0) return "";

  const destPy = UE5_IMPORT_DESTINATION_PATH.replace(/'/g, "\\'");

  const lines: string[] = [
    "# --- Asset imports from Poly Haven / Sketchfab ---",
    "import unreal, urllib.request, os",
    "",
    "download_dir = 'C:/GrandStudio/Downloads'",
    "os.makedirs(download_dir, exist_ok=True)",
    "",
  ];

  for (const imp of imports) {
    const key = imp.source === "polyhaven" ? imp.assetId : (imp.query ?? imp.assetId);
    const url = storageUrls.get(key);
    if (!url) continue;

    const ext = meshExtensionFromDownloadUrl(url);
    const filename = `${(imp.label ?? key).replace(/[^a-zA-Z0-9_]/g, "_")}.${ext}`;
    const localPath = `C:/GrandStudio/Downloads/${filename}`;
    const destName = (imp.label ?? key).replace(/[^a-zA-Z0-9_]/g, "_") || "imported_mesh";
    const escapedUrl = url.replace(/'/g, "\\'");
    const escapedLocal = localPath.replace(/'/g, "\\'");
    const escapedDestName = destName.replace(/'/g, "\\'");

    lines.push(
      `# Import: ${imp.label ?? key}`,
      `try:`,
      `    local_file = '${escapedLocal}'`,
      `    if not os.path.exists(local_file):`,
      `        urllib.request.urlretrieve('${escapedUrl}', local_file)`,
      `    task = unreal.AssetImportTask()`,
      `    task.filename = local_file`,
      `    task.destination_path = '${destPy}'`,
      `    task.destination_name = '${escapedDestName}'`,
      `    task.replace_existing = True`,
      `    task.automated = True`,
      `    task.save = True`,
      `    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])`,
      `    unreal.log('Imported ${escapedDestName}')`,
      `except Exception as e:`,
      `    unreal.log_warning(f'Import failed for ${imp.label ?? key}: {e}')`,
      ``
    );
  }

  return lines.join("\n");
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
 * Resolves all asset import Tags in an AI response by fetching real download
 * URLs from Poly Haven / Sketchfab, then returns the combined UE5 import code.
 */
export async function resolveAssets(
  aiResponse: string
): Promise<ResolvedAssets> {
  const imports = parseImportTags(aiResponse);
  if (imports.length === 0) return { imports: [], importCode: "" };

  const storageUrls = new Map<string, string>();

  const sfToken = process.env.SKETCHFAB_API_TOKEN ?? "";

  await Promise.all(
    imports.map(async (imp) => {
      try {
        if (imp.source === "polyhaven") {
          const url = await getModelDownloadUrl(imp.assetId);
          if (url) storageUrls.set(imp.assetId, url);
        } else if (imp.source === "sketchfab" && imp.query) {
          const results = await searchSketchfab(imp.query, {
            count: 1,
            token: sfToken,
          });
          if (results.length > 0 && sfToken) {
            const dlUrl = await getSketchfabDownloadUrl(results[0].uid, sfToken);
            if (dlUrl) storageUrls.set(imp.query, dlUrl);
          }
        }
      } catch (e) {
        console.warn(`[AssetResolver] Failed to resolve ${imp.source}`, e);
      }
    })
  );

  const importCode = generateImportPython(imports, storageUrls);
  return { imports, importCode };
}
