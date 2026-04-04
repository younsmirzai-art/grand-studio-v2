/** UE content path for Grand Studio imports (single folder, no Meshes subfolder). */
export const UE5_IMPORT_DESTINATION_PATH = "/Game/GrandStudio/Imported";

/** @deprecated Prefer UE5_IMPORT_DESTINATION_PATH */
export const UE5_IMPORT_MESH_DESTINATION_PATH = UE5_IMPORT_DESTINATION_PATH;

export type UE5ImportCodeOptions = {
  /** When set (e.g. Poly Haven), local file basename under Downloads is `{sanitized}.fbx`. */
  traceAssetId?: string;
  destinationName?: string;
};

function escapePySingle(s: string): string {
  return s.replace(/'/g, "\\'");
}

/**
 * Mesh-only import from C:/GrandStudio/Downloads (relay must place the file first).
 * No textures, materials, or follow-up Python — avoids FBX name collisions with materials.
 */
export function generateUE5ImportCode(
  _sourceUrlForLog: string,
  filename: string,
  label: string,
  options?: UE5ImportCodeOptions
): string {
  if (options?.traceAssetId) {
    console.log(
      `GENERATING LOCAL IMPORT FOR: assetId=${options.traceAssetId} file=${filename}`
    );
  }
  const safeLabel = label.replace(/[^a-zA-Z0-9_]/g, "_");
  const baseName = filename.includes(".") ? filename.replace(/\.[^.]+$/, "") : filename;
  const defaultDest = baseName.replace(/[^a-zA-Z0-9_]/g, "_") || safeLabel;
  const destinationName = (options?.destinationName ?? defaultDest).replace(/[^a-zA-Z0-9_]/g, "_") || safeLabel;

  const diskFile =
    options?.traceAssetId != null && options.traceAssetId !== ""
      ? `${defaultDest.replace(/[^a-zA-Z0-9_]/g, "_")}.fbx`
      : filename.includes("/") || filename.includes("\\")
        ? filename.split(/[/\\]/).pop()!
        : `${defaultDest}.fbx`;

  const filepath = `C:/GrandStudio/Downloads/${diskFile}`;
  const destPy = escapePySingle(UE5_IMPORT_DESTINATION_PATH);
  const filepathPy = escapePySingle(filepath);
  const namePy = escapePySingle(destinationName);

  return `import unreal
import os
filepath = '${filepathPy}'
if os.path.exists(filepath):
    task = unreal.AssetImportTask()
    task.filename = filepath
    task.destination_path = '${destPy}'
    task.destination_name = '${namePy}'
    task.replace_existing = True
    task.automated = True
    task.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    unreal.log('Imported ${namePy}')
else:
    unreal.log('ERROR: File not found: ' + filepath)
`;
}

/**
 * Sketchfab: mesh-only import from relay path `{importStem}_model.(glb|fbx|obj)`.
 */
export function generateSketchfabLocalImportCode(
  importStem: string,
  _label: string,
  options?: UE5ImportCodeOptions
): string {
  if (options?.traceAssetId) {
    console.log(
      `GENERATING SKETCHFAB LOCAL IMPORT: uid=${options.traceAssetId} stem=${importStem}`
    );
  }
  const destinationName = (
    options?.destinationName ?? importStem.replace(/[^a-zA-Z0-9_]/g, "_")
  ).replace(/[^a-zA-Z0-9_]/g, "_");
  const stemEscaped = importStem.replace(/'/g, "\\'");
  const destPy = UE5_IMPORT_DESTINATION_PATH.replace(/'/g, "\\'");
  const namePy = destinationName.replace(/'/g, "\\'");

  return `import unreal
import os
filepath = None
_base = r'C:/GrandStudio/Downloads/${stemEscaped}_model'
for _ext in ('.glb', '.fbx', '.obj'):
    _p = _base + _ext
    if os.path.exists(_p):
        filepath = _p
        break
if filepath is None:
    unreal.log('ERROR: File not found: ' + str(_base) + '.*')
else:
    task = unreal.AssetImportTask()
    task.filename = filepath
    task.destination_path = '${destPy}'
    task.destination_name = '${namePy}'
    task.replace_existing = True
    task.automated = True
    task.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    unreal.log('Imported ${namePy}')
`;
}

/* -------------------------------------------------------------------------- */
/* Texture / material helpers removed — restore from git history when re-enabled. */
/* -------------------------------------------------------------------------- */
