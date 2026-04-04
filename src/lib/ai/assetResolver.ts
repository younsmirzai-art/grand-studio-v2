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

/** Wrap UE import snippets in try/except; kept for any future local code paths. */
export function combineLocalImportFragments(fragments: string[]): string {
  if (fragments.length === 0) return "";
  let out = "# --- Asset imports ---\n";
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

export function combineCodeWithImports(originalPython: string, importCode: string): string {
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
  return response.replace(POLYHAVEN_RE, "").replace(SKETCHFAB_RE, "").trim();
}

/**
 * Parses Poly Haven / Sketchfab import tags. Import code is no longer emitted (relay removed);
 * users add assets via the workspace 3D Library download flow.
 */
export async function resolveAssets(aiResponse: string, _projectId?: string): Promise<ResolvedAssets> {
  const imports = parseImportTags(aiResponse);
  if (imports.length > 0) {
    console.info(
      "[AssetResolver] Import tags present but remote import pipeline removed — use workspace downloads."
    );
  }
  return { imports, importCode: "" };
}
