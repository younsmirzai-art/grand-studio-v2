/**
 * Shared UE5 Python import code template. Used by:
 * - AI Co-Pilot import flow (handleAssetRequest)
 * - Direct Import button in Asset Library (WorkspacePanel)
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
