/** Import status classification for post-import validation. */
export type ImportStatus = "textured" | "materials_only" | "mesh_only" | "failed";

/** UE content path for static meshes — keeps meshes out of the same folder as imported materials. */
export const UE5_IMPORT_MESH_DESTINATION_PATH = "/Game/GrandStudio/Imported/Meshes";

export function inferMaterialCategoryFromLabels(name: string, id?: string): string {
  const s = `${name} ${id ?? ""}`.toLowerCase();
  if (/\b(tree|trees|plant|plants|palm|bush|bushes|vine|fern|foliage|grass)\b/.test(s)) return "plant";
  if (/\b(rock|rocks|stone|stones|boulder|boulders|cliff|pebble)\b/.test(s)) return "rock";
  if (/\b(house|houses|building|buildings|cabin|barn|tower|hut|structure|castle)\b/.test(s)) return "building";
  if (/\b(barrel|barrels|crate|crates|cask)\b/.test(s)) return "barrel";
  if (/\b(chair|chairs|table|tables|desk|desks|sofa|sofas|couch|bed|beds|furniture|shelf|shelves|armchair)\b/.test(s)) {
    return "furniture";
  }
  if (/\b(metal|steel|iron|chrome|car|cars|vehicle|vehicles|robot|robots|pipe|pipes)\b/.test(s)) return "metal";
  return "furniture";
}

/**
 * Python snippet: validates import result (material/texture count, status) and prints IMPORT_RESULT line.
 * Expects: task (AssetImportTask), _import_file_type (str: glb, fbx, obj, etc.).
 */
const VALIDATION_SNIPPET = `
import json
_import_imported_paths = task.get_editor_property('imported_object_paths')
_ue_asset_path = str(_import_imported_paths[0]) if _import_imported_paths and len(_import_imported_paths) > 0 else ''
_material_count = 0
_texture_count = 0
_import_status = 'failed'
if _import_imported_paths and len(_import_imported_paths) > 0:
    unreal.log('Import completed. Validating asset...')
    _asset = unreal.EditorAssetLibrary.load_asset(_ue_asset_path)
    if _asset:
        try:
            _static_mats = _asset.get_editor_property('static_materials')
        except Exception:
            try:
                _static_mats = getattr(_asset, 'static_materials', [])
            except Exception:
                _static_mats = []
        _material_count = len(_static_mats)
        for _sm in _static_mats:
            try:
                _mat = _sm.get_editor_property('material_interface') if hasattr(_sm, 'get_editor_property') else getattr(_sm, 'material_interface', None)
                if _mat:
                    try:
                        _refd = _mat.get_editor_property('referenced_textures')
                        if _refd:
                            _texture_count += len(_refd)
                    except Exception:
                        pass
            except Exception:
                pass
        if _material_count >= 1 and _texture_count >= 1:
            _import_status = 'textured'
        elif _material_count >= 1:
            _import_status = 'materials_only'
        else:
            _import_status = 'mesh_only'
    unreal.log(f'material_count={_material_count} texture_count={_texture_count} status={_import_status}')
else:
    unreal.log('Import completed but no imported paths (failed).')
_result = {'ue_asset_path': _ue_asset_path, 'material_count': _material_count, 'texture_count': _texture_count, 'import_status': _import_status, 'import_error': None}
unreal.log('IMPORT_RESULT:' + json.dumps(_result))
`;

export function pythonStarterMaterialPathForCategory(category: string): string {
  switch (category.toLowerCase()) {
    case "plant":
    case "vegetation":
      return "/Game/StarterContent/Materials/M_Ground_Grass";
    case "rock":
      return "/Game/StarterContent/Materials/M_Rock_Slate";
    case "building":
      return "/Game/StarterContent/Materials/M_Brick_Clay_Beveled";
    case "metal":
      return "/Game/StarterContent/Materials/M_Metal_Burnished_Steel";
    case "barrel":
    case "crate":
      return "/Game/StarterContent/Materials/M_Wood_Oak";
    case "furniture":
    default:
      return "/Game/StarterContent/Materials/M_Wood_Floor_Walnut_Polished";
  }
}

/** Apply StarterContent on the imported StaticMesh using `imported_paths[0]` (after AssetImportTask). */
function buildApplyStarterMaterialToImportedPathPython(escapedStarterMatPath: string): string {
  return `
unreal.log('Applying StarterContent material to imported mesh asset.')
if imported_paths and len(imported_paths) > 0:
    _gs_um_path = str(imported_paths[0])
    _gs_mesh = unreal.EditorAssetLibrary.load_asset(_gs_um_path)
    _gs_mat = unreal.EditorAssetLibrary.load_asset('${escapedStarterMatPath}')
    if _gs_mesh and _gs_mat:
        try:
            _gs_n = _gs_mesh.get_num_materials()
        except Exception:
            _gs_n = 1
        for _gsi in range(max(_gs_n, 1)):
            try:
                _gs_mesh.set_material(_gsi, _gs_mat)
            except Exception as _e_gs:
                unreal.log_warning('mesh.set_material slot %d: %s' % (_gsi, str(_e_gs)))
        try:
            unreal.EditorAssetLibrary.save_asset(_gs_um_path)
        except Exception as _e_save:
            unreal.log_warning('save_asset mesh: %s' % str(_e_save))
        unreal.log('Material applied to mesh asset')
`.trim();
}

/** Validation + StarterContent on mesh asset via `imported_paths` (set before this snippet). */
export function pythonPostImportValidationAndMaterialFallbackForLabel(
  label: string,
  idHint?: string,
  _destinationName?: string
): string {
  const cat = inferMaterialCategoryFromLabels(label, idHint);
  const mat = pythonStarterMaterialPathForCategory(cat).replace(/'/g, "\\'");
  return `${VALIDATION_SNIPPET.trim()}\n${buildApplyStarterMaterialToImportedPathPython(mat)}`;
}

export type UE5ImportCodeOptions = {
  /** Logged in dev when set (Poly Haven import trace). */
  traceAssetId?: string;
  /** Unique asset name under /Game/GrandStudio/Imported/Meshes (avoids overwriting). */
  destinationName?: string;
  /** If true, only import — do not spawn a temporary actor (batch import + place later). */
  skipSpawnActor?: boolean;
  /**
   * StarterContent material fallback category (plant, rock, building, barrel, furniture, metal).
   * If omitted, inferred from label / traceAssetId.
   */
  materialCategory?: string;
};

/**
 * UE5 5.7+: AssetImportTask has no import_materials / import_textures on the task.
 * Minimal import: filename, destination_path, destination_name, replace_existing=True, automated, save only.
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
  const skipSpawn = options?.skipSpawnActor === true;
  const localPath = `C:/GrandStudio/Downloads/${filename}`;
  const fileType = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "glb";

  const spawnBlock = skipSpawn
    ? ""
    : `
if imported_paths and len(imported_paths) > 0:
    asset = unreal.EditorAssetLibrary.load_asset(str(imported_paths[0]))
    if asset:
        editor = unreal.EditorLevelLibrary
        actor = editor.spawn_actor_from_object(asset, unreal.Vector(0, 0, 0))
        if actor:
            actor.set_actor_label('${safeLabel}')
            unreal.log('Asset placed in level!')`;

  const matCategory =
    options?.materialCategory ?? inferMaterialCategoryFromLabels(label, options?.traceAssetId);
  const matPathEscaped = pythonStarterMaterialPathForCategory(matCategory).replace(/'/g, "\\'");
  const applyMatToAsset = `\n${buildApplyStarterMaterialToImportedPathPython(matPathEscaped)}`;

  const meshDestEscaped = UE5_IMPORT_MESH_DESTINATION_PATH.replace(/'/g, "\\'");

  return `import unreal
import urllib.request
import os
os.makedirs('C:/GrandStudio/Downloads', exist_ok=True)
try:
    unreal.EditorAssetLibrary.make_directory('${meshDestEscaped}')
except Exception:
    pass
url = '${downloadUrl.replace(/'/g, "\\'")}'
local_path = '${localPath}'
unreal.log('Download started.')
urllib.request.urlretrieve(url, local_path)
unreal.log(f'Downloaded: {local_path}')
unreal.log('Import started.')
task = unreal.AssetImportTask()
task.set_editor_property('filename', local_path)
task.set_editor_property('destination_path', '${meshDestEscaped}')
task.set_editor_property('destination_name', '${destinationName}')
task.set_editor_property('replace_existing', True)
task.set_editor_property('automated', True)
task.set_editor_property('save', True)
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
imported_paths = task.get_editor_property('imported_object_paths')${spawnBlock}${applyMatToAsset}
_import_file_type = '${fileType}'
${VALIDATION_SNIPPET.trim()}
`;
}

/**
 * Sketchfab import: API returns a ZIP URL. Download ZIP, extract — prefer .glb (embedded) before .fbx/.obj (no .gltf).
 * UE5 5.7+: same minimal AssetImportTask as generateUE5ImportCode (no import_materials / FbxImportUI on task).
 */
export type SketchfabImportCodeOptions = UE5ImportCodeOptions;

export function generateSketchfabImportCode(
  downloadUrl: string,
  zipFilename: string,
  label: string,
  options?: SketchfabImportCodeOptions
): string {
  if (options?.traceAssetId) {
    console.log(`GENERATING IMPORT FOR: assetId=${options.traceAssetId}, url=${downloadUrl}`);
  }
  const safeLabel = label.replace(/[^a-zA-Z0-9_]/g, "_");
  const baseName = zipFilename.replace(/\.zip$/i, "");
  const zipPath = `C:/GrandStudio/Downloads/${zipFilename}`;
  const extractDir = `C:/GrandStudio/Downloads/${baseName}_extracted`;
  const escapedUrl = downloadUrl.replace(/'/g, "\\'");
  const skipSpawn = options?.skipSpawnActor === true;
  const destOverride = options?.destinationName?.replace(/[^a-zA-Z0-9_]/g, "_");
  const destNameBlock = destOverride
    ? `    _dest_name = '${destOverride}'`
    : `    _stem = os.path.splitext(os.path.basename(model_file))[0]
    _dest_name = ''.join(c if c.isalnum() or c == '_' else '_' for c in _stem)`;

  const spawnBlock = skipSpawn
    ? ""
    : `
    if imported_paths and len(imported_paths) > 0:
        asset = unreal.EditorAssetLibrary.load_asset(str(imported_paths[0]))
        if asset:
            actor = unreal.EditorLevelLibrary.spawn_actor_from_object(asset, unreal.Vector(0, 0, 0))
            if actor:
                actor.set_actor_label('${safeLabel}')
                unreal.log('Sketchfab model placed in level!')`;

  const meshDestEscaped = UE5_IMPORT_MESH_DESTINATION_PATH.replace(/'/g, "\\'");
  const matCategory =
    options?.materialCategory ?? inferMaterialCategoryFromLabels(label, options?.traceAssetId);
  const matPathEscaped = pythonStarterMaterialPathForCategory(matCategory).replace(/'/g, "\\'");
  const matAssetOnImportSketchfab = buildApplyStarterMaterialToImportedPathPython(matPathEscaped)
    .trim()
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n");

  return `import unreal
import urllib.request
import os
import zipfile
import glob
import shutil
import json
os.makedirs('C:/GrandStudio/Downloads', exist_ok=True)
zip_path = '${zipPath}'
extract_dir = '${extractDir}'
unreal.log('Download started.')
urllib.request.urlretrieve('${escapedUrl}', zip_path)
unreal.log(f'Downloaded ZIP: {zip_path}')
if os.path.isdir(extract_dir):
    shutil.rmtree(extract_dir)
os.makedirs(extract_dir, exist_ok=True)
with zipfile.ZipFile(zip_path, 'r') as z:
    z.extractall(extract_dir)
unreal.log(f'Extracted to: {extract_dir}')
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
    unreal.log('IMPORT_RESULT:' + json.dumps({'ue_asset_path': '', 'material_count': 0, 'texture_count': 0, 'import_status': 'failed', 'import_error': 'No 3D model file in ZIP'}))
else:
    unreal.log(f'Found model: {model_file}')
    unreal.log('Import started.')
    model_dir = os.path.dirname(model_file)
    texture_extensions = ['.png', '.jpg', '.jpeg', '.tga', '.bmp']
    for tex_ext in texture_extensions:
        for tex_file in glob.glob(os.path.join(extract_dir, '**', '*' + tex_ext), recursive=True):
            dest = os.path.join(model_dir, os.path.basename(tex_file))
            if not os.path.exists(dest):
                shutil.copy2(tex_file, dest)
${destNameBlock}
    try:
        unreal.EditorAssetLibrary.make_directory('${meshDestEscaped}')
    except Exception:
        pass
    task = unreal.AssetImportTask()
    task.set_editor_property('filename', model_file)
    task.set_editor_property('destination_path', '${meshDestEscaped}')
    task.set_editor_property('destination_name', _dest_name)
    task.set_editor_property('replace_existing', True)
    task.set_editor_property('automated', True)
    task.set_editor_property('save', True)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    imported_paths = task.get_editor_property('imported_object_paths')${spawnBlock}
    _import_file_type = model_file.split('.')[-1].lower() if '.' in model_file else 'glb'
${matAssetOnImportSketchfab}
${VALIDATION_SNIPPET.trim()
  .split("\n")
  .map((l) => "    " + l)
  .join("\n")}
`;
}
