export function generateScanCode(): string {
  return `import unreal
import json
import os

OUTPUT_PATH = "C:/GrandStudio/asset_scan.json"
ROOT = "/Game"
USEFUL_TYPES = {
    "StaticMesh",
    "SkeletalMesh",
    "Material",
    "MaterialInstance",
    "Texture2D",
    "Blueprint",
    "SoundWave",
    "NiagaraSystem",
    "World",
    "ParticleSystem",
}

def _safe_file_size(asset_path):
    try:
        obj = unreal.EditorAssetLibrary.load_asset(asset_path)
        if obj is None:
            return None
        pkg = obj.get_outer()
        if pkg is None:
            return None
        pkg_name = pkg.get_name()
        disk_path = unreal.Paths.convert_package_to_filename(pkg_name, ".uasset")
        if disk_path and os.path.exists(disk_path):
            return os.path.getsize(disk_path)
    except Exception:
        pass
    return None

def _top_level_game_folders():
    try:
        folders = unreal.EditorAssetLibrary.list_assets(ROOT, recursive=False, include_folder=True)
        out = [f for f in folders if isinstance(f, str) and f.startswith("/Game/")]
        return sorted(set(out))
    except Exception:
        return []

def run_scan():
    os.makedirs("C:/GrandStudio", exist_ok=True)
    all_assets = unreal.EditorAssetLibrary.list_assets(ROOT, recursive=True, include_folder=False) or []
    assets = []
    by_type_count = {}
    for asset_path in all_assets:
        try:
            asset_class = unreal.EditorAssetLibrary.get_asset_class(asset_path) or "Unknown"
            if asset_class not in USEFUL_TYPES:
                continue
            name = asset_path.split("/")[-1]
            size_bytes = _safe_file_size(asset_path)
            row = {
                "path": asset_path,
                "name": name,
                "type": asset_class,
                "size_bytes": size_bytes,
            }
            assets.append(row)
            by_type_count[asset_class] = by_type_count.get(asset_class, 0) + 1
        except Exception as e:
            unreal.log_warning("[GrandStudio AssetScanner] Failed for " + str(asset_path) + ": " + str(e))

    payload = {
        "scanned_at": str(unreal.DateTime.now()),
        "root": ROOT,
        "important_roots": [
            "/Game",
            "/Game/StarterContent",
            "/Game/Megascans",
            "/Game/GrandStudio/Imported",
        ],
        "top_level_folders": _top_level_game_folders(),
        "count": len(assets),
        "by_type_count": by_type_count,
        "assets": assets,
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    unreal.log("[GrandStudio AssetScanner] Scanned " + str(len(assets)) + " assets")

run_scan()
`;
}

