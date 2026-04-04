/** UE content path for Grand Studio imports (single folder, no Meshes subfolder). */
export const UE5_IMPORT_DESTINATION_PATH = "/Game/GrandStudio/Imported";

/** @deprecated Prefer UE5_IMPORT_DESTINATION_PATH */
export const UE5_IMPORT_MESH_DESTINATION_PATH = UE5_IMPORT_DESTINATION_PATH;

export type UE5ImportCodeOptions = {
  /** When set (e.g. Poly Haven), local file is forced to `.fbx`. */
  traceAssetId?: string;
  destinationName?: string;
  /** Poly Haven diffuse map URL; when set, Python imports texture and assigns a material to the mesh. */
  textureUrl?: string | null;
};

const UE5_TEXTURES_PATH = "/Game/GrandStudio/Imported/Textures";
const UE5_MATERIALS_PATH = "/Game/GrandStudio/Imported/Materials";

function diffuseFileExtensionFromUrl(url: string): string {
  try {
    const p = new URL(url).pathname.toLowerCase();
    if (p.endsWith(".png")) return "png";
    if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "jpg";
    if (p.endsWith(".webp")) return "webp";
    if (p.endsWith(".exr")) return "exr";
  } catch {
    /* ignore */
  }
  return "jpg";
}

/** Python fragment: download diffuse, import texture, MIC + assign to mesh at `destinationName`. */
export function buildPolyHavenDiffuseFollowUpPython(textureUrl: string, destinationName: string): string {
  const dest = destinationName.replace(/[^a-zA-Z0-9_]/g, "_") || "mesh";
  const ext = diffuseFileExtensionFromUrl(textureUrl);
  const texBase = `${dest}_diffuse`.replace(/[^a-zA-Z0-9_]/g, "_") || "diffuse";
  const texFile = `${texBase}.${ext}`;
  const escapedTexUrl = textureUrl.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const escapedTexPath = `C:/GrandStudio/Downloads/${texFile}`.replace(/'/g, "\\'");
  const texDestPy = UE5_TEXTURES_PATH.replace(/'/g, "\\'");
  const matDestPy = UE5_MATERIALS_PATH.replace(/'/g, "\\'");
  const texAssetPath = `${UE5_TEXTURES_PATH}/${texBase}`.replace(/'/g, "\\'");
  const meshAssetPath = `${UE5_IMPORT_DESTINATION_PATH}/${dest}`.replace(/'/g, "\\'");
  const miName = `MI_${texBase}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 50) || "MI_ph_diffuse";

  return `
# Download and apply Poly Haven diffuse texture
_tex_url = '${escapedTexUrl}'
_tex_path = '${escapedTexPath}'
urllib.request.urlretrieve(_tex_url, _tex_path)
_tex_task = unreal.AssetImportTask()
_tex_task.filename = _tex_path
_tex_task.destination_path = '${texDestPy}'
_tex_task.destination_name = '${texBase}'
_tex_task.replace_existing = True
_tex_task.automated = True
_tex_task.save = True
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([_tex_task])
_tex = unreal.EditorAssetLibrary.load_asset('${texAssetPath}')
_mesh_path = '${meshAssetPath}'
_mesh = unreal.EditorAssetLibrary.load_asset(_mesh_path)
if _tex and _mesh:
    _parent_paths = [
        '/Game/StarterContent/Materials/M_AssetPlatform.M_AssetPlatform',
        '/Game/StarterContent/Materials/M_Basic_Wall.M_Basic_Wall',
    ]
    _parent = None
    for _pp in _parent_paths:
        _cand = unreal.EditorAssetLibrary.load_asset(_pp)
        if _cand:
            _parent = _cand
            break
    if _parent:
        _fac = unreal.MaterialInstanceConstantFactoryNew()
        _fac.set_editor_property('initial_parent', _parent)
        _tools = unreal.AssetToolsHelpers.get_asset_tools()
        _mi = _tools.create_asset('${miName}', '${matDestPy}', unreal.MaterialInstanceConstant, _fac)
        if _mi:
            for _pn in ('Texture', 'BaseColor', 'Diffuse'):
                try:
                    unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(_mi, _pn, _tex)
                    break
                except Exception:
                    pass
            try:
                _mesh.set_material(0, _mi)
            except Exception:
                try:
                    unreal.EditorStaticMeshLibrary.set_material(_mesh, 0, _mi)
                except Exception:
                    unreal.log_warning('Could not assign material to mesh slots')
            unreal.EditorAssetLibrary.save_asset(_mesh_path)
    else:
        unreal.log_warning('Poly Haven texture: no StarterContent parent material found; assign texture manually')
else:
    unreal.log_warning('Poly Haven texture: could not load texture or mesh for material assignment')
`;
}

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

  const textureUrl = options?.textureUrl?.trim();
  const diffuseFollowUp = textureUrl ? buildPolyHavenDiffuseFollowUpPython(textureUrl, destinationName) : "";

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
${diffuseFollowUp}`;
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
import uuid
os.makedirs('C:/GrandStudio/Downloads', exist_ok=True)
zip_path = '${zipPath.replace(/'/g, "\\'")}'
_extract_id = str(uuid.uuid4())[:12]
extract_dir = os.path.join('C:/GrandStudio/Downloads', '${baseName.replace(/'/g, "\\'")}_ext_' + _extract_id)
urllib.request.urlretrieve('${escapedUrl}', zip_path)
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
