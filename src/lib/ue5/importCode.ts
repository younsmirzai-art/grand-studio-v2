/**
 * Direct file import (Poly Haven FBX/GLB, etc.). Single file downloaded and imported.
 */
export function generateUE5ImportCode(
  downloadUrl: string,
  filename: string,
  label: string
): string {
  const safeLabel = label.replace(/[^a-zA-Z0-9_]/g, "_");
  const localPath = `C:/GrandStudio/Downloads/${filename}`;

  return `import unreal
import urllib.request
import os
os.makedirs('C:/GrandStudio/Downloads', exist_ok=True)
url = '${downloadUrl.replace(/'/g, "\\'")}'
local_path = '${localPath}'
urllib.request.urlretrieve(url, local_path)
unreal.log(f'Downloaded: {local_path}')
task = unreal.AssetImportTask()
task.set_editor_property('filename', local_path)
task.set_editor_property('destination_path', '/Game/GrandStudio/Imported')
task.set_editor_property('automated', True)
task.set_editor_property('save', True)
task.set_editor_property('replace_existing', True)
task.set_editor_property('import_materials', True)
task.set_editor_property('import_textures', True)
if local_path.lower().endswith('.fbx'):
    fbx_import_ui = unreal.FbxImportUI()
    fbx_import_ui.set_editor_property('import_materials', True)
    fbx_import_ui.set_editor_property('import_textures', True)
    fbx_import_ui.set_editor_property('import_as_skeletal', False)
    try:
        fbx_import_ui.texture_import_data.set_editor_property('material_search_location', unreal.MaterialSearchLocation.LOCAL)
    except Exception:
        pass
    try:
        fbx_import_ui.static_mesh_import_data.set_editor_property('combine_meshes', True)
    except Exception:
        pass
    task.set_editor_property('options', fbx_import_ui)
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
imported_paths = task.get_editor_property('imported_object_paths')
if imported_paths and len(imported_paths) > 0:
    asset = unreal.EditorAssetLibrary.load_asset(str(imported_paths[0]))
    if asset:
        editor = unreal.EditorLevelLibrary
        actor = editor.spawn_actor_from_object(asset, unreal.Vector(0, 0, 0))
        if actor:
            actor.set_actor_label('${safeLabel}')
            unreal.log('Asset placed in level!')
`;
}

/**
 * Sketchfab import: API returns a ZIP URL. Download ZIP, extract, find .glb/.fbx/.gltf/.obj and import.
 */
export function generateSketchfabImportCode(
  downloadUrl: string,
  zipFilename: string,
  label: string
): string {
  const safeLabel = label.replace(/[^a-zA-Z0-9_]/g, "_");
  const baseName = zipFilename.replace(/\.zip$/i, "");
  const zipPath = `C:/GrandStudio/Downloads/${zipFilename}`;
  const extractDir = `C:/GrandStudio/Downloads/${baseName}_extracted`;
  const escapedUrl = downloadUrl.replace(/'/g, "\\'");

  return `import unreal
import urllib.request
import os
import zipfile
import glob
import shutil
os.makedirs('C:/GrandStudio/Downloads', exist_ok=True)
zip_path = '${zipPath}'
extract_dir = '${extractDir}'
urllib.request.urlretrieve('${escapedUrl}', zip_path)
unreal.log(f'Downloaded ZIP: {zip_path}')
os.makedirs(extract_dir, exist_ok=True)
with zipfile.ZipFile(zip_path, 'r') as z:
    z.extractall(extract_dir)
unreal.log(f'Extracted to: {extract_dir}')
model_file = None
for ext in ['.glb', '.fbx', '.gltf', '.obj']:
    found = glob.glob(os.path.join(extract_dir, '**', '*' + ext), recursive=True)
    if found:
        model_file = found[0]
        break
if not model_file:
    unreal.log_error('No 3D model file found in ZIP')
else:
    unreal.log(f'Found model: {model_file}')
    model_dir = os.path.dirname(model_file)
    texture_extensions = ['.png', '.jpg', '.jpeg', '.tga', '.bmp']
    for tex_ext in texture_extensions:
        for tex_file in glob.glob(os.path.join(extract_dir, '**', '*' + tex_ext), recursive=True):
            dest = os.path.join(model_dir, os.path.basename(tex_file))
            if not os.path.exists(dest):
                shutil.copy2(tex_file, dest)
    task = unreal.AssetImportTask()
    task.set_editor_property('filename', model_file)
    task.set_editor_property('destination_path', '/Game/GrandStudio/Imported')
    task.set_editor_property('automated', True)
    task.set_editor_property('save', True)
    task.set_editor_property('replace_existing', True)
    task.set_editor_property('import_materials', True)
    task.set_editor_property('import_textures', True)
    if model_file.lower().endswith('.fbx'):
        fbx_import_ui = unreal.FbxImportUI()
        fbx_import_ui.set_editor_property('import_materials', True)
        fbx_import_ui.set_editor_property('import_textures', True)
        fbx_import_ui.set_editor_property('import_as_skeletal', False)
        try:
            fbx_import_ui.texture_import_data.set_editor_property('material_search_location', unreal.MaterialSearchLocation.LOCAL)
        except Exception:
            pass
        try:
            fbx_import_ui.static_mesh_import_data.set_editor_property('combine_meshes', True)
        except Exception:
            pass
        task.set_editor_property('options', fbx_import_ui)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    imported_paths = task.get_editor_property('imported_object_paths')
    if imported_paths and len(imported_paths) > 0:
        asset = unreal.EditorAssetLibrary.load_asset(str(imported_paths[0]))
        if asset:
            actor = unreal.EditorLevelLibrary.spawn_actor_from_object(asset, unreal.Vector(0, 0, 0))
            if actor:
                actor.set_actor_label('${safeLabel}')
                unreal.log('Sketchfab model placed in level!')
`;
}
