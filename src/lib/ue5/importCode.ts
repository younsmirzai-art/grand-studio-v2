/** UE content path for Grand Studio imports (single folder, no Meshes subfolder). */
export const UE5_IMPORT_DESTINATION_PATH = "/Game/GrandStudio/Imported";

/** @deprecated Prefer UE5_IMPORT_DESTINATION_PATH */
export const UE5_IMPORT_MESH_DESTINATION_PATH = UE5_IMPORT_DESTINATION_PATH;

export type UE5ImportCodeOptions = {
  /** When set (e.g. Poly Haven), local file basename under Downloads is forced to `{sanitized}_dest.fbx`. */
  traceAssetId?: string;
  destinationName?: string;
  /**
   * Diffuse basename only, already on disk at C:/GrandStudio/Downloads/{diffuseDiskFilename}
   * (relay download). No network in UE5.
   */
  diffuseDiskFilename?: string | null;
};

const UE5_TEXTURES_PATH = "/Game/GrandStudio/Imported/Textures";
const UE5_MATERIALS_PATH = "/Game/GrandStudio/Imported/Materials";

export function diffuseFileExtensionFromUrl(url: string): string {
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

/** Python fragment: import diffuse from local disk, MIC + assign to mesh. */
export function buildPolyHavenDiffuseFollowUpPython(
  diffuseDiskFilename: string,
  destinationName: string
): string {
  const dest = destinationName.replace(/[^a-zA-Z0-9_]/g, "_") || "mesh";
  const safeFile = diffuseDiskFilename.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const texStem = safeFile.includes(".") ? safeFile.replace(/\.[^.]+$/, "") : safeFile;
  const texBase = texStem.replace(/[^a-zA-Z0-9_]/g, "_") || "diffuse";
  const escapedTexPath = `C:/GrandStudio/Downloads/${safeFile}`.replace(/'/g, "\\'");
  const texDestPy = UE5_TEXTURES_PATH.replace(/'/g, "\\'");
  const matDestPy = UE5_MATERIALS_PATH.replace(/'/g, "\\'");
  const texAssetPath = `${UE5_TEXTURES_PATH}/${texBase}`.replace(/'/g, "\\'");
  const meshAssetPath = `${UE5_IMPORT_DESTINATION_PATH}/${dest}`.replace(/'/g, "\\'");
  const miName = `MI_${texBase}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 50) || "MI_ph_diffuse";

  return `
# Apply Poly Haven diffuse from local file (downloaded by relay)
import os
_tex_path = '${escapedTexPath}'
if not os.path.exists(_tex_path):
    unreal.log_warning('WARNING: Texture file NOT found: ' + _tex_path)
else:
    unreal.log('Texture file exists: ' + _tex_path)
    unreal.log('Applying texture from: ' + _tex_path)
    _tex_task = unreal.AssetImportTask()
    _tex_task.filename = _tex_path
    _tex_task.destination_path = '${texDestPy}'
    _tex_task.destination_name = '${texBase}'
    _tex_task.replace_existing = True
    _tex_task.automated = True
    _tex_task.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([_tex_task])
_tex = unreal.EditorAssetLibrary.load_asset('${texAssetPath}') if os.path.exists(_tex_path) else None
_mesh_path = '${meshAssetPath}'
_mesh = unreal.EditorAssetLibrary.load_asset(_mesh_path)
if _tex and _mesh:
    _parent_paths = [
        '/Engine/EngineMaterials/DefaultMaterial.DefaultMaterial',
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
            for _pn in ('BaseColor', 'Texture', 'Diffuse', 'Albedo', 'DiffuseTexture', 'T_BaseColor'):
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

export type SketchfabImportCodeOptions = UE5ImportCodeOptions & {
  /**
   * If true (default), UE tries C:/GrandStudio/Downloads/{importStem}_diffuse.* after relay may copy a texture from the Sketchfab ZIP.
   */
  relayDiffuseTexture?: boolean;
};

/** UE Python: pick first existing {importStem}_diffuse.(jpg|png|…) and apply like Poly diffuse. */
export function buildOptionalDiffuseByDownloadStemPython(
  importStem: string,
  meshDestinationName: string
): string {
  const dest = meshDestinationName.replace(/[^a-zA-Z0-9_]/g, "_") || "mesh";
  const stemEsc = importStem.replace(/'/g, "\\'");
  const texBase =
    `${importStem.replace(/[^a-zA-Z0-9_]/g, "_")}_skfb_diffuse`
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .slice(0, 45) || "skfb_diffuse";
  const texDestPy = UE5_TEXTURES_PATH.replace(/'/g, "\\'");
  const matDestPy = UE5_MATERIALS_PATH.replace(/'/g, "\\'");
  const texAssetPath = `${UE5_TEXTURES_PATH}/${texBase}`.replace(/'/g, "\\'");
  const meshAssetPath = `${UE5_IMPORT_DESTINATION_PATH}/${dest}`.replace(/'/g, "\\'");
  const miName = `MI_${texBase}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 50) || "MI_skfb_diffuse";

  return `
# Optional Sketchfab diffuse from relay (C:/GrandStudio/Downloads/{stem}_diffuse.*)
import os
_stem_d = r'C:/GrandStudio/Downloads/${stemEsc}_diffuse'
_tex_path = None
for _e in ('.jpg', '.jpeg', '.png', '.webp', '.tga', '.exr'):
    _cand = _stem_d + _e
    if os.path.exists(_cand):
        _tex_path = _cand
        break
if _tex_path:
    unreal.log('Texture file exists: ' + _tex_path)
    unreal.log('Applying texture from: ' + _tex_path)
    _tex_task2 = unreal.AssetImportTask()
    _tex_task2.filename = _tex_path
    _tex_task2.destination_path = '${texDestPy}'
    _tex_task2.destination_name = '${texBase}'
    _tex_task2.replace_existing = True
    _tex_task2.automated = True
    _tex_task2.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([_tex_task2])
    _tex2 = unreal.EditorAssetLibrary.load_asset('${texAssetPath}')
    _mesh_path2 = '${meshAssetPath}'
    _mesh2 = unreal.EditorAssetLibrary.load_asset(_mesh_path2)
    if _tex2 and _mesh2:
        _parent_paths2 = [
            '/Engine/EngineMaterials/DefaultMaterial.DefaultMaterial',
            '/Game/StarterContent/Materials/M_AssetPlatform.M_AssetPlatform',
            '/Game/StarterContent/Materials/M_Basic_Wall.M_Basic_Wall',
        ]
        _parent2 = None
        for _pp2 in _parent_paths2:
            _c2 = unreal.EditorAssetLibrary.load_asset(_pp2)
            if _c2:
                _parent2 = _c2
                break
        if _parent2:
            _fac2 = unreal.MaterialInstanceConstantFactoryNew()
            _fac2.set_editor_property('initial_parent', _parent2)
            _tools2 = unreal.AssetToolsHelpers.get_asset_tools()
            _mi2 = _tools2.create_asset('${miName}', '${matDestPy}', unreal.MaterialInstanceConstant, _fac2)
            if _mi2:
                for _pn2 in ('BaseColor', 'Texture', 'Diffuse', 'Albedo', 'DiffuseTexture', 'T_BaseColor'):
                    try:
                        unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(_mi2, _pn2, _tex2)
                        break
                    except Exception:
                        pass
                try:
                    _mesh2.set_material(0, _mi2)
                except Exception:
                    try:
                        unreal.EditorStaticMeshLibrary.set_material(_mesh2, 0, _mi2)
                    except Exception:
                        unreal.log_warning('Sketchfab: could not assign diffuse material')
                unreal.EditorAssetLibrary.save_asset(_mesh_path2)
else:
    unreal.log_warning('WARNING: Texture file NOT found for stem ' + r'${stemEsc}_diffuse.*')
`;
}

/**
 * Import a mesh from a file already on disk (relay downloaded). No urllib / no network in UE5.
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
      : filename.includes(".")
        ? filename.split(/[/\\]/).pop()!
        : `${defaultDest}.fbx`;

  const localPath = `C:/GrandStudio/Downloads/${diskFile}`;
  const destPy = UE5_IMPORT_DESTINATION_PATH.replace(/'/g, "\\'");
  const escapedLocal = localPath.replace(/'/g, "\\'");
  const logName = destinationName.replace(/'/g, "\\'");

  const diffuseName = options?.diffuseDiskFilename?.trim();
  const diffuseFollowUp =
    diffuseName && diffuseName.length > 0
      ? buildPolyHavenDiffuseFollowUpPython(diffuseName, destinationName)
      : "";

  return `import unreal
task = unreal.AssetImportTask()
task.filename = '${escapedLocal}'
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
 * Sketchfab: import model file left by relay at C:/GrandStudio/Downloads/{importStem}_model.(glb|fbx|obj).
 */
export function generateSketchfabLocalImportCode(
  importStem: string,
  _label: string,
  options?: SketchfabImportCodeOptions
): string {
  if (options?.traceAssetId) {
    console.log(
      `GENERATING SKETCHFAB LOCAL IMPORT: uid=${options.traceAssetId} stem=${importStem}`
    );
  }
  const destinationName = (
    options?.destinationName ?? importStem.replace(/[^a-zA-Z0-9_]/g, "_")
  ).replace(/[^a-zA-Z0-9_]/g, "_");
  const logName = destinationName.replace(/'/g, "\\'");
  const stemEscaped = importStem.replace(/'/g, "\\'");
  const destPy = UE5_IMPORT_DESTINATION_PATH.replace(/'/g, "\\'");
  const wantDiffuse = options?.relayDiffuseTexture !== false;
  const diffuseTail = wantDiffuse
    ? buildOptionalDiffuseByDownloadStemPython(importStem, destinationName)
    : "";

  return `import unreal
import os
_base = r'C:/GrandStudio/Downloads/${stemEscaped}_model'
model_file = None
for _ext in ('.glb', '.fbx', '.obj'):
    _p = _base + _ext
    if os.path.exists(_p):
        model_file = _p
        break
if not model_file:
    unreal.log_error('Sketchfab: missing relay model at ' + str(_base) + '.*')
else:
    task = unreal.AssetImportTask()
    task.filename = model_file
    task.destination_path = '${destPy}'
    task.destination_name = '${logName}'
    task.replace_existing = True
    task.automated = True
    task.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    unreal.log('Imported ${logName}')
${diffuseTail}`;
}
