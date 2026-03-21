/**
 * UE5 Python for Content Browser scan. Heavy logging + dual discovery (EditorAssetLibrary + AssetRegistry).
 */
export function generateScanCode(): string {
  return `import unreal
import json
import os
import traceback
import datetime as _dt

LOG_PREFIX = "[GrandStudio AssetScanner]"
OUTPUT_PATH = "C:/GrandStudio/asset_scan.json"
ROOT = "/Game"

# No type filter: include every asset under /Game. Frontend can filter later.
DEBUG_CLASS_SAMPLE_COUNT = 20
BATCH_LOG_EVERY = 500


def _log(msg):
    try:
        unreal.log(LOG_PREFIX + " " + str(msg))
    except Exception:
        pass


def _log_warn(msg):
    try:
        unreal.log_warning(LOG_PREFIX + " " + str(msg))
    except Exception:
        pass


def _log_err(msg):
    try:
        unreal.log_error(LOG_PREFIX + " " + str(msg))
    except Exception:
        pass


def _safe_file_size(asset_path):
    try:
        try:
            obj = unreal.EditorAssetLibrary.load_asset(asset_path)
        except Exception as e:
            return None
        if obj is None:
            return None
        try:
            pkg = obj.get_outer()
        except Exception:
            return None
        if pkg is None:
            return None
        try:
            pkg_name = pkg.get_name()
        except Exception:
            return None
        try:
            disk_path = unreal.Paths.convert_package_to_filename(pkg_name, ".uasset")
        except Exception:
            return None
        if disk_path and os.path.exists(disk_path):
            try:
                return os.path.getsize(disk_path)
            except Exception:
                return None
    except Exception:
        pass
    return None


def _normalize_class_name(raw):
    try:
        if raw is None:
            return "Unknown"
        s = str(raw).strip()
        if not s:
            return "Unknown"
        if "." in s:
            s = s.split(".")[-1]
        if "'" in s:
            parts = s.split("'")
            if len(parts) >= 2:
                s = parts[-2].split(".")[-1]
        return s
    except Exception:
        return "Unknown"


def _classify_asset(asset_path):
    """Returns (raw_class_from_ue, type_for_json). Unknown if None/empty/failed."""
    raw = None
    try:
        try:
            raw = unreal.EditorAssetLibrary.get_asset_class(asset_path)
        except Exception:
            raw = None
        if raw is None:
            return None, "Unknown"
        try:
            s = str(raw).strip()
        except Exception:
            return raw, "Unknown"
        if not s:
            return raw, "Unknown"
        return raw, _normalize_class_name(raw)
    except Exception:
        return None, "Unknown"


def _collect_via_list_assets():
    paths = []
    method = "EditorAssetLibrary.list_assets"
    try:
        try:
            raw = unreal.EditorAssetLibrary.list_assets(ROOT, recursive=True, include_folder=False)
        except Exception as e:
            _log_warn(method + " failed: " + str(e))
            return paths, None
        if raw is None:
            return paths, method
        try:
            paths = [str(p) for p in raw if isinstance(p, str) and p.startswith("/Game")]
        except Exception as e:
            _log_warn("Normalizing list_assets result: " + str(e))
            paths = []
        return paths, method
    except Exception as e:
        _log_err(method + " outer: " + str(e))
        _log_err(traceback.format_exc())
        return [], None


def _collect_via_asset_registry():
    paths = []
    method = "AssetRegistry.get_assets"
    try:
        try:
            reg = unreal.AssetRegistryHelpers.get_asset_registry()
        except Exception as e1:
            _log_warn("AssetRegistryHelpers.get_asset_registry failed: " + str(e1))
            try:
                reg = unreal.AssetRegistry.get_asset_registry()
            except Exception as e2:
                _log_warn("AssetRegistry.get_asset_registry failed: " + str(e2))
                return [], None
        ar_filter = None
        try:
            ar_filter = unreal.ARFilter(package_paths=[ROOT], recursive_paths=True)
        except Exception as e:
            _log_warn("ARFilter(package_paths) failed: " + str(e))
            try:
                ar_filter = unreal.ARFilter()
                ar_filter.package_paths = [ROOT]
                ar_filter.recursive_paths = True
            except Exception as e2:
                _log_warn("ARFilter manual set failed: " + str(e2))
                return [], None
        try:
            asset_data_list = reg.get_assets(ar_filter)
        except Exception as e:
            _log_warn("get_assets failed: " + str(e))
            return [], method
        if not asset_data_list:
            return [], method
        for ad in asset_data_list:
            try:
                p = None
                try:
                    op = getattr(ad, "object_path", None)
                    if op is not None:
                        if hasattr(op, "path_string"):
                            p = str(op.path_string)
                        else:
                            p = str(op)
                except Exception:
                    p = None
                if not p or not isinstance(p, str):
                    try:
                        pkg = str(getattr(ad, "package_name", "") or "")
                        an = str(getattr(ad, "asset_name", "") or "")
                        if pkg.startswith("/Game") and an:
                            p = pkg + "/" + an + "." + an
                    except Exception:
                        p = None
                if p and isinstance(p, str) and p.startswith("/Game"):
                    paths.append(p)
            except Exception:
                continue
        return paths, method
    except Exception as e:
        _log_err(method + " outer: " + str(e))
        _log_err(traceback.format_exc())
        return [], None


def _top_level_game_folders():
    try:
        try:
            folders = unreal.EditorAssetLibrary.list_assets(ROOT, recursive=False, include_folder=True)
        except Exception:
            return []
        if not folders:
            return []
        out = []
        for f in folders:
            try:
                if isinstance(f, str) and f.startswith("/Game/"):
                    out.append(f)
            except Exception:
                continue
        return sorted(set(out))
    except Exception:
        return []


def run_scan():
    try:
        _log("Step 1: Starting scan…")
    except Exception:
        pass
    scan_method_primary = None
    scan_method_fallback = None
    all_paths = []
    try:
        try:
            os.makedirs("C:/GrandStudio", exist_ok=True)
            _log("Step 1b: Output dir OK")
        except Exception as e:
            _log_err("mkdir failed: " + str(e))
            _log_err(traceback.format_exc())
            return

        try:
            _log("Step 2: Listing assets (method A: EditorAssetLibrary)…")
        except Exception:
            pass
        paths_a, m_a = _collect_via_list_assets()
        try:
            _log("Step 2a: list_assets returned " + str(len(paths_a)) + " raw paths" + (" via " + m_a if m_a else ""))
        except Exception:
            pass
        if m_a:
            scan_method_primary = m_a

        try:
            _log("Step 2b: Listing assets (method B: AssetRegistry)…")
        except Exception:
            pass
        paths_b, m_b = _collect_via_asset_registry()
        try:
            _log("Step 2c: registry returned " + str(len(paths_b)) + " raw paths" + (" via " + m_b if m_b else ""))
        except Exception:
            pass
        if m_b:
            scan_method_fallback = m_b

        try:
            merged = []
            seen = set()
            for p in paths_a + paths_b:
                try:
                    if p not in seen:
                        seen.add(p)
                        merged.append(p)
                except Exception:
                    continue
            all_paths = merged
        except Exception as e:
            _log_err("merge paths: " + str(e))
            all_paths = list(paths_a) if paths_a else list(paths_b)

        try:
            _log("Step 3: Found " + str(len(all_paths)) + " unique raw asset paths under /Game")
        except Exception:
            pass

        assets = []
        by_type_count = {}
        errors = 0

        try:
            _log("Step 4: Enriching ALL assets (no type filter). Debug: first " + str(DEBUG_CLASS_SAMPLE_COUNT) + " class names logged…")
        except Exception:
            pass

        for idx, asset_path in enumerate(all_paths):
            try:
                if idx > 0 and idx % BATCH_LOG_EVERY == 0:
                    try:
                        _log("Step 4 progress: processed " + str(idx) + "/" + str(len(all_paths)))
                    except Exception:
                        pass
            except Exception:
                pass
            ap = "/Game"
            asset_class = "Unknown"
            name = "asset"
            size_bytes = None
            raw_cls = None
            try:
                try:
                    ap = str(asset_path)
                except Exception:
                    try:
                        ap = repr(asset_path)
                    except Exception:
                        ap = "/Game/Unknown"
                    errors += 1
                try:
                    raw_cls, asset_class = _classify_asset(ap)
                except Exception:
                    raw_cls, asset_class = None, "Unknown"
                    errors += 1
                try:
                    if idx < DEBUG_CLASS_SAMPLE_COUNT:
                        try:
                            if raw_cls is None:
                                cls_dbg = "None"
                            else:
                                try:
                                    cls_dbg = str(raw_cls)
                                except Exception:
                                    cls_dbg = "(unprintable)"
                            _log("Step 4 debug: Asset: " + ap + " → Class: " + cls_dbg)
                        except Exception:
                            pass
                except Exception:
                    pass
                try:
                    name = ap.split("/")[-1]
                    if "." in name:
                        name = name.split(".")[-1]
                except Exception:
                    name = "asset"
                try:
                    size_bytes = _safe_file_size(ap)
                except Exception:
                    size_bytes = None
            except Exception as e:
                errors += 1
                try:
                    _log_warn("Per-asset loop error: " + str(e))
                except Exception:
                    pass
            try:
                row = {
                    "path": ap,
                    "name": name,
                    "type": asset_class,
                    "size_bytes": size_bytes,
                }
                assets.append(row)
                by_type_count[asset_class] = by_type_count.get(asset_class, 0) + 1
            except Exception as e:
                errors += 1
                _log_err("Could not append row: " + str(e))

        try:
            _log("Step 4 done: included " + str(len(assets)) + " assets (expected " + str(len(all_paths)) + "), errors " + str(errors))
        except Exception:
            pass

        try:
            scanned_iso = _dt.datetime.utcnow().isoformat() + "Z"
        except Exception:
            scanned_iso = "unknown"

        try:
            payload = {
                "scanned_at": scanned_iso,
                "root": ROOT,
                "scan_method_primary": scan_method_primary,
                "scan_method_fallback": scan_method_fallback,
                "important_roots": [
                    "/Game",
                    "/Game/Fab",
                    "/Game/GrandStudio",
                    "/Game/StarterContent",
                    "/Game/Megascans",
                ],
                "top_level_folders": _top_level_game_folders(),
                "raw_path_count": len(all_paths),
                "count": len(assets),
                "type_filter": "none",
                "per_asset_errors": errors,
                "by_type_count": by_type_count,
                "assets": assets,
            }
        except Exception as e:
            _log_err("Payload build failed: " + str(e))
            _log_err(traceback.format_exc())
            return

        try:
            _log("Step 5: Writing JSON to " + OUTPUT_PATH + " …")
        except Exception:
            pass
        try:
            with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False)
        except Exception as e:
            _log_err("Write JSON failed: " + str(e))
            _log_err(traceback.format_exc())
            return

        try:
            _log("Step 6: Scan complete! Wrote " + str(len(assets)) + " assets")
        except Exception:
            pass
    except Exception as e:
        try:
            _log_err("FATAL scan error: " + str(e))
            _log_err(traceback.format_exc())
        except Exception:
            pass


try:
    run_scan()
except Exception as _e:
    try:
        unreal.log_error(LOG_PREFIX + " top-level: " + str(_e))
        unreal.log_error(traceback.format_exc())
    except Exception:
        pass
`;
}
