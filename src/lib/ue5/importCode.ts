/** UE content path for Grand Studio imports (single folder, no Meshes subfolder). */
export const UE5_IMPORT_DESTINATION_PATH = "/Game/GrandStudio/Imported";

/** Textures live under Imported so everything stays under one Grand Studio tree. */
export const UE5_IMPORT_TEXTURES_PATH = `${UE5_IMPORT_DESTINATION_PATH}/Textures`;

/** @deprecated Prefer UE5_IMPORT_DESTINATION_PATH */
export const UE5_IMPORT_MESH_DESTINATION_PATH = UE5_IMPORT_DESTINATION_PATH;

export type UE5ImportCodeOptions = {
  /** When set (e.g. Poly Haven), local FBX basename under Downloads is `{sanitized}.fbx`. */
  traceAssetId?: string;
  destinationName?: string;
  /**
   * Poly Haven: diffuse basename under Downloads (relay writes it), e.g. `sofa_03_diffuse.jpg`.
   */
  diffuseDiskFilename?: string | null;
};

export type SketchfabImportCodeOptions = UE5ImportCodeOptions & {
  /** When true (default), if relay left `{importStem}_diffuse.*` on disk, import and apply to MICs. */
  applyRelayDiffuseTexture?: boolean;
};

function escapePySingle(s: string): string {
  return s.replace(/'/g, "\\'");
}

function indentPythonLines(block: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return block
    .split("\n")
    .map((line) => (line.length === 0 ? "" : pad + line))
    .join("\n");
}

/** Infer file extension from Poly Haven / CDN diffuse URL. */
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

/**
 * After texture import, load at `texLoadPath` and set BaseColor/Diffuse on MICs under `importRoot`.
 * UE 5.7+: no MaterialInstanceConstantFactoryNew / initial_parent.
 */
function buildApplyDiffuseToImportedMicsPython(texLoadPath: string, importRoot: string): string {
  const texPy = escapePySingle(texLoadPath);
  const rootPy = escapePySingle(importRoot);
  return `# Assign to materials created during mesh import
_tex_apply = unreal.EditorAssetLibrary.load_asset('${texPy}')
if _tex_apply:
    _import_folder = '${rootPy}'
    _all_paths = unreal.EditorAssetLibrary.list_assets(_import_folder, recursive=True)
    for _asset_path in _all_paths:
        _asset = unreal.EditorAssetLibrary.load_asset(_asset_path)
        if _asset and _asset.get_class().get_name() == 'MaterialInstanceConstant':
            try:
                unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(_asset, 'BaseColor', _tex_apply)
                unreal.EditorAssetLibrary.save_asset(_asset_path)
                unreal.log('Applied texture to material: ' + _asset_path)
            except Exception:
                try:
                    unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(_asset, 'Diffuse', _tex_apply)
                    unreal.EditorAssetLibrary.save_asset(_asset_path)
                    unreal.log('Applied texture (Diffuse) to material: ' + _asset_path)
                except Exception:
                    unreal.log('Could not apply texture to: ' + _asset_path)`;
}

/** Poly Haven: import diffuse from disk, then apply to existing MICs (indent = inside mesh-import if). */
function buildPolyDiffuseBlock(diffuseDiskFilename: string, textureUeBaseName: string): string {
  const safeFile = diffuseDiskFilename.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const texBase = textureUeBaseName.replace(/[^a-zA-Z0-9_]/g, "_") || "asset_diffuse";
  const texPathDisk = escapePySingle(`C:/GrandStudio/Downloads/${safeFile}`);
  const texDestPy = escapePySingle(UE5_IMPORT_TEXTURES_PATH);
  const texLoadFull = `${UE5_IMPORT_TEXTURES_PATH}/${texBase}`;
  const namePy = escapePySingle(texBase);

  const body = `# Import diffuse texture (Poly Haven relay)
_tex_path = '${texPathDisk}'
if os.path.exists(_tex_path):
    _tex_task = unreal.AssetImportTask()
    _tex_task.filename = _tex_path
    _tex_task.destination_path = '${texDestPy}'
    _tex_task.destination_name = '${namePy}'
    _tex_task.replace_existing = True
    _tex_task.automated = True
    _tex_task.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([_tex_task])
${indentPythonLines(buildApplyDiffuseToImportedMicsPython(texLoadFull, UE5_IMPORT_DESTINATION_PATH), 4)}`;
  return indentPythonLines(body, 4);
}

/** Sketchfab: optional `{stem}_diffuse.*` from relay ZIP extract. */
function buildSketchfabDiffuseBlock(importStem: string, textureUeBaseName: string): string {
  const stemEsc = importStem.replace(/'/g, "\\'");
  const texBase = textureUeBaseName.replace(/[^a-zA-Z0-9_]/g, "_");
  const texDestPy = escapePySingle(UE5_IMPORT_TEXTURES_PATH);
  const texLoadFull = `${UE5_IMPORT_TEXTURES_PATH}/${texBase}`;
  const namePy = escapePySingle(texBase);

  const body = `# Optional relay diffuse from ZIP
_tex_path_sf = None
_tex_stem = r'C:/GrandStudio/Downloads/${stemEsc}_diffuse'
for _e in ('.jpg', '.jpeg', '.png', '.webp', '.tga', '.exr'):
    _cand_sf = _tex_stem + _e
    if os.path.exists(_cand_sf):
        _tex_path_sf = _cand_sf
        break
if _tex_path_sf:
    _tex_task_sf = unreal.AssetImportTask()
    _tex_task_sf.filename = _tex_path_sf
    _tex_task_sf.destination_path = '${texDestPy}'
    _tex_task_sf.destination_name = '${namePy}'
    _tex_task_sf.replace_existing = True
    _tex_task_sf.automated = True
    _tex_task_sf.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([_tex_task_sf])
${indentPythonLines(buildApplyDiffuseToImportedMicsPython(texLoadFull, UE5_IMPORT_DESTINATION_PATH), 4)}`;
  return indentPythonLines(body, 4);
}

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
  const texDirPy = escapePySingle(UE5_IMPORT_TEXTURES_PATH);
  const filepathPy = escapePySingle(filepath);
  const namePy = escapePySingle(destinationName);

  const diffuseName = options?.diffuseDiskFilename?.trim();
  const textureBaseForDiffuse = `${destinationName}_diffuse`.replace(/[^a-zA-Z0-9_]/g, "_");
  const diffuseBlock =
    diffuseName && diffuseName.length > 0
      ? buildPolyDiffuseBlock(diffuseName, textureBaseForDiffuse)
      : "";

  return `import unreal
import os
unreal.EditorAssetLibrary.make_directory('${texDirPy}')
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
${diffuseBlock}
else:
    unreal.log('ERROR: File not found: ' + filepath)
`;
}

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
  const stemEscaped = importStem.replace(/'/g, "\\'");
  const destPy = UE5_IMPORT_DESTINATION_PATH.replace(/'/g, "\\'");
  const texDirPy = UE5_IMPORT_TEXTURES_PATH.replace(/'/g, "\\'");
  const namePy = destinationName.replace(/'/g, "\\'");
  const wantDiffuse = options?.applyRelayDiffuseTexture !== false;
  const texBaseSk = `${importStem.replace(/[^a-zA-Z0-9_]/g, "_")}_diffuse`;
  const diffuseBlock = wantDiffuse ? buildSketchfabDiffuseBlock(importStem, texBaseSk) : "";

  return `import unreal
import os
unreal.EditorAssetLibrary.make_directory('${texDirPy}')
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
${diffuseBlock ? `${diffuseBlock}\n` : ""}`;
}
