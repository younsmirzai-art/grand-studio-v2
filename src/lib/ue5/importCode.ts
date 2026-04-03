/** UE content path for Grand Studio imports (single folder, no Meshes subfolder). */
export const UE5_IMPORT_DESTINATION_PATH = "/Game/GrandStudio/Imported";

/** @deprecated Prefer UE5_IMPORT_DESTINATION_PATH */
export const UE5_IMPORT_MESH_DESTINATION_PATH = UE5_IMPORT_DESTINATION_PATH;

export type UE5ImportCodeOptions = {
  /** When set (e.g. Poly Haven), local file is forced to `.fbx`. */
  traceAssetId?: string;
  destinationName?: string;
};

export type SketchfabImportCodeOptions = UE5ImportCodeOptions;

/**
 * Minimal import: download file → AssetImportTask → /Game/GrandStudio/Imported.
 * Uses direct task field assignment (Unreal Python).
 */
export function generateUE5ImportCode(
  downloadUrl: string,
  filename: string,
  label: string,
  options?: UE5ImportCodeOptions
): string {
  if (options?.traceAssetId) {
    console.log(`GENERATING IMPORT FOR: assetId=${options.traceAssetId}, url=${downloadUrl}`);
  }
  const safeLabel = label.replace(/[^a-zA-Z0-9_]/g, "_");
  const baseName = filename.includes(".") ? filename.replace(/\.[^.]+$/, "") : filename;
  const defaultDest = baseName.replace(/[^a-zA-Z0-9_]/g, "_") || safeLabel;
  const destinationName = (options?.destinationName ?? defaultDest).replace(/[^a-zA-Z0-9_]/g, "_") || safeLabel;

  const diskFile =
    options?.traceAssetId != null && options.traceAssetId !== ""
      ? `${defaultDest.replace(/[^a-zA-Z0-9_]/g, "_")}.fbx`
      : filename.includes(".")
        ? filename.split(/[/\\]/).pop()!
        : `${defaultDest}.fbx`;

  const localPath = `C:/GrandStudio/Downloads/${diskFile}`;
  const destPy = UE5_IMPORT_DESTINATION_PATH.replace(/'/g, "\\'");

  const escapedUrl = downloadUrl.replace(/'/g, "\\'");
  const escapedLocal = localPath.replace(/'/g, "\\'");
  const logName = destinationName.replace(/'/g, "\\'");

  return `import unreal
import urllib.request
import os
os.makedirs('C:/GrandStudio/Downloads', exist_ok=True)
url = '${escapedUrl}'
local_path = '${escapedLocal}'
urllib.request.urlretrieve(url, local_path)
task = unreal.AssetImportTask()
task.filename = local_path
task.destination_path = '${destPy}'
task.destination_name = '${logName}'
task.replace_existing = True
task.automated = True
task.save = True
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
unreal.log('Imported ${logName}')
`;
}

/**
 * Sketchfab: download ZIP → extract → pick a model file → same minimal AssetImportTask.
 */
export function generateSketchfabImportCode(
  downloadUrl: string,
  zipFilename: string,
  _label: string,
  options?: SketchfabImportCodeOptions
): string {
  if (options?.traceAssetId) {
    console.log(`GENERATING IMPORT FOR: assetId=${options.traceAssetId}, url=${downloadUrl}`);
  }
  const baseName = zipFilename.replace(/\.zip$/i, "");
  const zipPath = `C:/GrandStudio/Downloads/${zipFilename}`;
  const extractDir = `C:/GrandStudio/Downloads/${baseName}_extracted`;
  const escapedUrl = downloadUrl.replace(/'/g, "\\'");
  const destOverride = options?.destinationName?.replace(/[^a-zA-Z0-9_]/g, "_");
  const destNameBlock = destOverride
    ? `_dest_name = '${destOverride.replace(/'/g, "\\'")}'`
    : `_stem = os.path.splitext(os.path.basename(model_file))[0]
_dest_name = ''.join(c if c.isalnum() or c == '_' else '_' for c in _stem)`;

  const destPy = UE5_IMPORT_DESTINATION_PATH.replace(/'/g, "\\'");

  return `import unreal
import urllib.request
import os
import zipfile
import glob
import shutil
os.makedirs('C:/GrandStudio/Downloads', exist_ok=True)
zip_path = '${zipPath.replace(/'/g, "\\'")}'
extract_dir = '${extractDir.replace(/'/g, "\\'")}'
urllib.request.urlretrieve('${escapedUrl}', zip_path)
if os.path.isdir(extract_dir):
    shutil.rmtree(extract_dir)
os.makedirs(extract_dir, exist_ok=True)
with zipfile.ZipFile(zip_path, 'r') as z:
    z.extractall(extract_dir)
model_file = None
for ext in ['.glb', '.fbx', '.obj']:
    found = glob.glob(os.path.join(extract_dir, '**', '*' + ext), recursive=True)
    found = [p for p in found if '__MACOSX' not in p]
    if found:
        scored = []
        for p in found:
            rel = os.path.relpath(p, extract_dir)
            depth = rel.count(os.sep)
            try:
                sz = os.path.getsize(p)
            except OSError:
                sz = 0
            scored.append((depth, -sz, p))
        scored.sort()
        model_file = scored[0][2]
        break
if not model_file:
    unreal.log_error('No 3D model file found in ZIP')
else:
    ${destNameBlock}
    task = unreal.AssetImportTask()
    task.filename = model_file
    task.destination_path = '${destPy}'
    task.destination_name = _dest_name
    task.replace_existing = True
    task.automated = True
    task.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    unreal.log('Imported ' + str(_dest_name))
`;
}
