/** Import status classification for post-import validation. */
export type ImportStatus = "textured" | "materials_only" | "mesh_only" | "failed";

/**
 * Python snippet: validates import result (material/texture count, status) and prints IMPORT_RESULT line.
 * Expects: task (AssetImportTask), _import_file_type (str e.g. 'fbx').
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
      return "/Game/StarterContent/Materials/M_Ground_Grass";
    case "rock":
      return "/Game/StarterContent/Materials/M_Rock_Slate";
    case "building":
      return "/Game/StarterContent/Materials/M_Brick_Clay_Beveled";
    case "metal":
      return "/Game/StarterContent/Materials/M_Metal_Burnished_Steel";
    case "furniture":
    default:
      return "/Game/StarterContent/Materials/M_Wood_Floor_Walnut_Polished";
  }
}

function buildMaterialFallbackPython(escapedMaterialPath: string): string {
  return `
if _ue_asset_path and (_import_status == 'mesh_only' or _material_count == 0):
    _mat_fb2 = unreal.EditorAssetLibrary.load_asset('${escapedMaterialPath}')
    _mesh_fb2 = unreal.EditorAssetLibrary.load_asset(_ue_asset_path)
    if _mat_fb2 and _mesh_fb2:
        try:
            if hasattr(unreal.EditorStaticMeshLibrary, 'set_material'):
                unreal.EditorStaticMeshLibrary.set_material(_mesh_fb2, 0, _mat_fb2)
        except Exception as _e2:
            unreal.log_warning('Starter material (mesh): ' + str(_e2))
        try:
            for _a2 in unreal.EditorLevelLibrary.get_all_level_actors():
                _c2 = _a2.get_component_by_class(unreal.StaticMeshComponent)
                if _c2 and _c2.static_mesh == _mesh_fb2:
                    _c2.set_material(0, _mat_fb2)
        except Exception:
            pass
`.trim();
}

export type UE5ImportCodeOptions = {
  /** Logged in dev when set (Poly Haven import trace). */
  traceAssetId?: string;
  /** Unique asset name under /Game/GrandStudio/Imported (avoids overwriting). */
  destinationName?: string;
  /** Default true; use false when each import uses a unique destinationName. */
  replaceExisting?: boolean;
  /** If true, only import — do not spawn a temporary actor (batch import + place later). */
  skipSpawnActor?: boolean;
  /** When set, applies StarterContent material if the import has no materials (plant, rock, building, furniture, metal). */
  materialCategory?: string;
};

/**
 * UE5 5.7+: AssetImportTask has no import_materials / import_textures on the task.
 * Minimal import: filename, destination_path, destination_name, replace_existing, automated, save only.
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
  const replaceExisting = options?.replaceExisting ?? true;
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

  const matExtra =
    options?.materialCategory !== undefined
      ? `\n${buildMaterialFallbackPython(
          pythonStarterMaterialPathForCategory(options.materialCategory).replace(/'/g, "\\'"),
        )}`
      : "";

  return `import unreal
import urllib.request
import os
os.makedirs('C:/GrandStudio/Downloads', exist_ok=True)
url = '${downloadUrl.replace(/'/g, "\\'")}'
local_path = '${localPath}'
unreal.log('Download started.')
urllib.request.urlretrieve(url, local_path)
unreal.log(f'Downloaded: {local_path}')
unreal.log('Import started.')
task = unreal.AssetImportTask()
task.set_editor_property('filename', local_path)
task.set_editor_property('destination_path', '/Game/GrandStudio/Imported')
task.set_editor_property('destination_name', '${destinationName}')
task.set_editor_property('replace_existing', ${replaceExisting ? "True" : "False"})
task.set_editor_property('automated', True)
task.set_editor_property('save', True)
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
imported_paths = task.get_editor_property('imported_object_paths')${spawnBlock}
_import_file_type = '${fileType}'
${VALIDATION_SNIPPET.trim()}${matExtra}
`;
}

/**
 * Sketchfab import: API returns a ZIP URL. Download ZIP, extract, find .glb/.fbx/.gltf/.obj and import.
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
  const replaceExisting = options?.replaceExisting ?? true;
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
for ext in ['.glb', '.fbx', '.gltf', '.obj']:
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
    task = unreal.AssetImportTask()
    task.set_editor_property('filename', model_file)
    task.set_editor_property('destination_path', '/Game/GrandStudio/Imported')
    task.set_editor_property('destination_name', _dest_name)
    task.set_editor_property('replace_existing', ${replaceExisting ? "True" : "False"})
    task.set_editor_property('automated', True)
    task.set_editor_property('save', True)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    imported_paths = task.get_editor_property('imported_object_paths')${spawnBlock}
    _import_file_type = model_file.split('.')[-1].lower() if '.' in model_file else 'glb'
${VALIDATION_SNIPPET.trim()
  .split("\n")
  .map((l) => "    " + l)
  .join("\n")}${
    options?.materialCategory !== undefined
      ? `\n${buildMaterialFallbackPython(
          pythonStarterMaterialPathForCategory(options.materialCategory).replace(/'/g, "\\'"),
        )
          .split("\n")
          .map((l) => (l.trim() ? `    ${l}` : l))
          .join("\n")}`
      : ""
  }
`;
}
