import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";
import { queueUE5Command } from "@/lib/ue5/commands";

function escapePyString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Python script run inside UE5 via relay — heavy logging for Output Log debugging */
function buildWorldExplorerPython(params: {
  latitude: number;
  longitude: number;
  locationName: string;
  cesiumToken: string;
}): string {
  const safeName = escapePyString(params.locationName.trim());
  const safeToken = escapePyString(params.cesiumToken);
  const lat = params.latitude;
  const lon = params.longitude;

  return `import unreal
import traceback

LATITUDE = ${lat}
LONGITUDE = ${lon}
LOCATION_NAME = '${safeName}'
CESIUM_TOKEN = '${safeToken}'
LABEL_TERRAIN = 'GS_WE_WorldTerrain'
LABEL_GOOGLE_3D = 'GS_WE_Google3DTiles'
LABEL_IMAGERY = 'GS_WE_BingImagery'
ION_TERRAIN = 1
ION_BING_AERIAL = 2
# Google Photorealistic 3D Tiles (textured cities; replaces plain OSM building geometry)
ION_GOOGLE_PHOTOREALISTIC_3D = 2275207
# WGS84 ellipsoid height (meters) — must be non-negative; negative values invert globe alignment
BASE_ORIGIN_HEIGHT = 300.0
ORIGIN_HEIGHT = max(0.0, abs(float(BASE_ORIGIN_HEIGHT)))
if ORIGIN_HEIGHT < 1.0:
    ORIGIN_HEIGHT = 300.0


def wlog(msg):
    try:
        unreal.log('[GrandStudio WorldExplorer] ' + str(msg))
    except Exception:
        pass


def wwarn(msg):
    try:
        unreal.log_warning('[GrandStudio WorldExplorer] ' + str(msg))
    except Exception:
        pass


def werr(msg):
    try:
        unreal.log_error('[GrandStudio WorldExplorer] ' + str(msg))
    except Exception:
        pass


def log_exc(context):
    werr('EXCEPTION in ' + context)
    try:
        werr(traceback.format_exc())
    except Exception:
        pass


def log_actor_transform(actor, context):
    """Debug: final placement (we do not apply rotations/scales — Cesium drives globe alignment)."""
    if actor is None:
        return
    try:
        loc = actor.get_actor_location()
    except Exception as e:
        wwarn(context + ': get_actor_location failed: ' + str(e))
        return
    try:
        rot = actor.get_actor_rotation()
    except Exception:
        rot = None
    try:
        scale = actor.get_actor_scale3d()
    except Exception:
        scale = None
    try:
        rtxt = 'None' if rot is None else (
            'P=' + str(rot.pitch) + ' Y=' + str(rot.yaw) + ' R=' + str(rot.roll)
        )
        stxt = 'None' if scale is None else (
            '(' + str(scale.x) + ',' + str(scale.y) + ',' + str(scale.z) + ')'
        )
        wlog(
            context + ' FINAL transform: loc=('
            + str(loc.x) + ',' + str(loc.y) + ',' + str(loc.z)
            + ') rot=' + rtxt + ' scale=' + stxt
        )
        if scale is not None and (
            float(scale.x) < 0 or float(scale.y) < 0 or float(scale.z) < 0
        ):
            wwarn(context + ': actor has negative scale component (unexpected for Cesium)')
    except Exception as e:
        wwarn(context + ': log_actor_transform failed: ' + str(e))


def identity_actor_transform_for_spawn():
    """Explicit identity: position 0, rotation 0, scale 1 (no inversion)."""
    return unreal.Transform(
        unreal.Vector(0, 0, 0),
        unreal.Rotator(0, 0, 0),
        unreal.Vector(1, 1, 1),
    )


def spawn_actor_identity(cls, debug_name):
    """
    Spawn with default world placement only — no custom actor rotation or scale.
    Uses explicit zero rotator when the Python API supports it.
    """
    loc = unreal.Vector(0, 0, 0)
    rot = unreal.Rotator(0, 0, 0)
    try:
        a = unreal.EditorLevelLibrary.spawn_actor_from_class(cls, loc, rot)
        wlog('spawn_actor_from_class ' + debug_name + ' (loc + zero rotator)')
    except TypeError:
        a = unreal.EditorLevelLibrary.spawn_actor_from_class(cls, loc)
        wlog('spawn_actor_from_class ' + debug_name + ' (loc only; API has no rot arg)')
    return a


def try_editor_props(obj, prop_value_pairs, context):
    """Try snake_case and PascalCase UPROPERTY names (UE Python varies by version)."""
    for prop, val in prop_value_pairs:
        variants = [prop]
        if '_' in prop:
            parts = [x for x in prop.split('_') if x]
            pascal = ''.join(x[0].upper() + x[1:] for x in parts)
            variants.append(pascal)
        if prop == 'ion_asset_id':
            variants.extend(['IonAssetID', 'ionAssetID'])
        if prop == 'ion_access_token':
            variants.extend(['IonAccessToken', 'ionAccessToken'])
        if prop == 'tileset_source':
            variants.extend(['TilesetSource', 'tilesetSource'])
        if prop == 'origin_latitude':
            variants.extend(['OriginLatitude', 'originLatitude'])
        if prop == 'origin_longitude':
            variants.extend(['OriginLongitude', 'originLongitude'])
        if prop == 'origin_height':
            variants.extend(['OriginHeight', 'originHeight'])
        if prop == 'maximum_screen_space_error':
            variants.extend(['MaximumScreenSpaceError', 'maximumScreenSpaceError'])
        if prop == 'maximum_cached_bytes':
            variants.extend(['MaximumCachedBytes', 'CacheBytes'])
        if prop == 'maximum_simultaneous_tile_loads':
            variants.extend(['MaximumSimultaneousTileLoads'])
        if prop == 'loading_descriptor_low':
            variants.extend(['LoadingDescriptorLow', 'loadingDescriptorLow'])
        if prop == 'loading_descriptor_high':
            variants.extend(['LoadingDescriptorHigh', 'loadingDescriptorHigh'])
        if prop == 'loading_descendant_limit':
            variants.extend(['LoadingDescendantLimit', 'loadingDescendantLimit'])
        if prop == 'preload_ancestors':
            variants.extend(['PreloadAncestors'])
        if prop == 'preload_siblings':
            variants.extend(['PreloadSiblings'])
        seen = set()
        unique_variants = []
        for v in variants:
            if v not in seen:
                seen.add(v)
                unique_variants.append(v)
        ok = False
        for pname in unique_variants:
            try:
                obj.set_editor_property(pname, val)
                wlog(context + ': set_editor_property(' + pname + ') OK')
                ok = True
                break
            except Exception as e:
                wlog(context + ': set_editor_property(' + pname + ') failed: ' + str(e))
        if not ok:
            wwarn(context + ': could not set any variant for logical prop ' + prop)


def enum_from_cesium_ion():
    """Resolve ETilesetSource::FromCesiumIon for explicit tileset source."""
    names = ('ETilesetSource', 'CesiumTilesetSource', 'TilesetSource')
    for n in names:
        en = getattr(unreal, n, None)
        if en is None:
            continue
        for val in ('FROM_CESIUM_ION', 'from_cesium_ion', 'FROMCESIUMION'):
            v = getattr(en, val, None)
            if v is not None:
                wlog('Resolved tileset source enum from ' + n + '.' + val)
                return v
    wwarn('Could not resolve ETilesetSource.FromCesiumIon; relying on defaults')
    return None


def find_georeference():
    for actor in unreal.EditorLevelLibrary.get_all_level_actors():
        try:
            if actor.get_class().get_name() == 'CesiumGeoreference':
                wlog('Found existing CesiumGeoreference: label=' + str(actor.get_actor_label()))
                return actor
        except Exception:
            continue
    return None


def spawn_georeference():
    wlog('Spawning new CesiumGeoreference')
    return spawn_actor_identity(unreal.CesiumGeoreference, 'CesiumGeoreference')


def find_tileset_by_labels(labels):
    """Match by actor *label* (not internal get_name Cesium3DTileset_0)."""
    out = []
    for actor in unreal.EditorLevelLibrary.get_all_level_actors():
        try:
            if actor.get_class().get_name() != 'Cesium3DTileset':
                continue
            lab = actor.get_actor_label() or ''
            for lb in labels:
                if lab == lb or lb in lab:
                    out.append(actor)
                    break
        except Exception:
            continue
    return out


def spawn_tileset(label):
    wlog('Spawning Cesium3DTileset, label will be ' + label)
    t = spawn_actor_identity(unreal.Cesium3DTileset, 'Cesium3DTileset')
    try:
        t.set_actor_label(label)
        wlog('Tileset spawned: internal_name=' + str(t.get_name()) + ' label=' + str(t.get_actor_label()))
    except Exception as e:
        wwarn('set_actor_label failed: ' + str(e))
    log_actor_transform(t, 'Tileset[' + label + '] (after spawn)')
    return t


def soft_path_for_actor(actor):
    try:
        p = actor.get_path_name()
        wlog('SoftObjectPath string: ' + p)
        return unreal.SoftObjectPath(p)
    except Exception as e:
        wwarn('get_path_name/SoftObjectPath failed: ' + str(e))
    return None


def link_georeference(tileset, geo, context):
    if geo is None:
        wwarn(context + ': no georeference to link')
        return
    # Try direct actor reference first
    for attempt in ('direct_actor', 'soft_object_path'):
        try:
            if attempt == 'direct_actor':
                tileset.set_editor_property('georeference', geo)
                wlog(context + ': georeference linked (direct actor ref)')
            else:
                sp = soft_path_for_actor(geo)
                if sp:
                    tileset.set_editor_property('georeference', sp)
                    wlog(context + ': georeference linked (SoftObjectPath)')
            break
        except Exception as e:
            wlog(context + ': georeference link try ' + attempt + ' failed: ' + str(e))


def call_tileset_refresh(tileset, context):
    for fn in ('refresh_tileset', 'RefreshTileset'):
        if hasattr(tileset, fn):
            try:
                getattr(tileset, fn)()
                wlog(context + ': called ' + fn + '()')
                return
            except Exception as e:
                wwarn(context + ': ' + fn + '() failed: ' + str(e))
    wlog(context + ': no refresh method found on tileset')


def invalidate_georef_cache(tileset, context):
    for fn in ('invalidate_resolved_georeference', 'InvalidateResolvedGeoreference'):
        if hasattr(tileset, fn):
            try:
                getattr(tileset, fn)()
                wlog(context + ': ' + fn + '() OK')
            except Exception as e:
                wwarn(context + ': ' + fn + ' failed: ' + str(e))


def configure_ion_tileset(tileset, ion_asset_id, label_ctx):
    wlog(label_ctx + ': configuring Ion asset ' + str(ion_asset_id))
    ion_enum = enum_from_cesium_ion()
    pairs = []
    if ion_enum is not None:
        pairs.append(('tileset_source', ion_enum))
    pairs.append(('ion_asset_id', int(ion_asset_id)))
    pairs.append(('ion_access_token', CESIUM_TOKEN))
    try_editor_props(tileset, pairs, label_ctx)
    try:
        r = tileset.get_editor_property('ion_asset_id')
        wlog(label_ctx + ': read-back ion_asset_id=' + str(r))
    except Exception as e:
        wlog(label_ctx + ': read-back ion_asset_id failed: ' + str(e))
    try:
        tok = tileset.get_editor_property('ion_access_token')
        wlog(label_ctx + ': read-back ion_access_token set=' + str(bool(tok and len(str(tok)) > 4)))
    except Exception as e:
        wlog(label_ctx + ': read-back token failed: ' + str(e))

def apply_tileset_quality_settings(tileset, label_ctx):
    """Force high visual quality and reduce aggressive LOD behavior."""
    # 2 GB in bytes
    cache_bytes_2gb = 2048 * 1024 * 1024
    wlog(label_ctx + ': applying quality settings')
    try_editor_props(
        tileset,
        [
            ('maximum_screen_space_error', 1.0),
            ('preload_ancestors', True),
            ('preload_siblings', True),
            # user-requested names:
            ('loading_descriptor_low', 0),
            ('loading_descriptor_high', 0),
            # actual Cesium runtime property in many versions:
            ('loading_descendant_limit', 0),
            ('maximum_cached_bytes', cache_bytes_2gb),
            ('maximum_simultaneous_tile_loads', 20),
        ],
        label_ctx + ' [quality]',
    )

def apply_georeference_quality_settings(geo_ref):
    """Best-effort quality/detail knobs when exposed by plugin version."""
    if geo_ref is None:
        return
    wlog('CesiumGeoreference: applying best-effort quality/detail settings')
    try_editor_props(
        geo_ref,
        [
            ('detail_level', 5),
            ('quality_level', 5),
            ('maximum_detail_level', 5),
            ('max_detail_level', 5),
        ],
        'CesiumGeoreference [quality]',
    )


def add_bing_imagery_overlay(terrain, context):
    if not hasattr(unreal, 'CesiumIonRasterOverlay'):
        wwarn('CesiumIonRasterOverlay class not exposed to Python; skip imagery overlay')
        return
    try:
        for c in terrain.get_components_by_class(unreal.CesiumIonRasterOverlay):
            cid = '-1'
            try:
                cid = str(c.get_editor_property('ion_asset_id'))
            except Exception:
                pass
            if cid == str(ION_BING_AERIAL):
                wlog(context + ': Bing aerial overlay already on terrain (Ion ID ' + str(ION_BING_AERIAL) + ')')
                return
    except Exception as e:
        wlog(context + ': overlay scan: ' + str(e))
    wlog(context + ': adding CesiumIonRasterOverlay (Bing Aerial Ion ID ' + str(ION_BING_AERIAL) + ')')
    try:
        overlay = terrain.add_component_by_class(
            unreal.CesiumIonRasterOverlay,
            False,
            identity_actor_transform_for_spawn(),
            False,
        )
        wlog(context + ': overlay component created class=' + overlay.get_class().get_name())
        try_editor_props(
            overlay,
            [('ion_asset_id', ION_BING_AERIAL), ('ion_access_token', CESIUM_TOKEN)],
            context + ' [imagery]',
        )
        for fn in ('add_to_tileset', 'AddToTileset'):
            if hasattr(overlay, fn):
                try:
                    getattr(overlay, fn)()
                    wlog(context + ': overlay ' + fn + '()')
                    break
                except Exception as e:
                    wwarn(context + ': overlay ' + fn + ' failed: ' + str(e))
        try:
            overlay.activate(False)
            wlog(context + ': overlay activate(False)')
        except Exception as e:
            wwarn(context + ': overlay activate failed: ' + str(e))
    except Exception as e:
        werr(context + ': add_component_by_class CesiumIonRasterOverlay failed: ' + str(e))
        log_exc('add_bing_imagery_overlay')


def try_run_console(world, cmd, ctx):
    try:
        unreal.SystemLibrary.execute_console_command(world, cmd)
        wlog(ctx + ': console: ' + cmd)
    except Exception as e:
        wwarn(ctx + ': console failed (' + cmd + '): ' + str(e))


def try_cesium_subsystem(world):
    """Probe for an editor/game Cesium subsystem (varies by plugin version)."""
    for cls_name in ('CesiumEditorSubsystem', 'CesiumSubsystem', 'CesiumIonSubsystem'):
        Cls = getattr(unreal, cls_name, None)
        if Cls is None:
            continue
        try:
            sub = unreal.get_editor_subsystem(Cls)
            wlog('Found editor subsystem: ' + cls_name + ' -> ' + str(sub))
            return sub
        except Exception:
            pass
        try:
            sub = unreal.get_engine_subsystem(Cls)
            wlog('Found engine subsystem: ' + cls_name + ' -> ' + str(sub))
            return sub
        except Exception:
            pass
    wlog('No known Cesium subsystem exposed to Python (this is OK)')


wlog('=== Import started: ' + LOCATION_NAME + ' @ (' + str(LATITUDE) + ', ' + str(LONGITUDE) + ') ===')
wlog(
    'Data sources: World Terrain Ion=' + str(ION_TERRAIN)
    + ', Google Photorealistic 3D Tiles Ion=' + str(ION_GOOGLE_PHOTOREALISTIC_3D)
    + ', Bing aerial overlay Ion=' + str(ION_BING_AERIAL)
)
wlog('CESIUM_TOKEN set on tilesets (length=' + str(len(CESIUM_TOKEN)) + ' chars)')

if not hasattr(unreal, 'CesiumGeoreference') or not hasattr(unreal, 'Cesium3DTileset'):
    werr('Required Cesium for Unreal classes missing. Enable plugin and restart UE5.')
else:
    world = None
    try:
        world = unreal.EditorLevelLibrary.get_editor_world()
        wlog('Editor world: ' + (world.get_name() if world else 'None'))
    except Exception as e:
        wwarn('get_editor_world: ' + str(e))

    try:
        try_cesium_subsystem(world)
    except Exception:
        log_exc('try_cesium_subsystem')

    geo_ref = None
    try:
        wlog('CesiumGeoreference: using origin_height=' + str(ORIGIN_HEIGHT) + ' m (enforced positive)')
        geo_ref = find_georeference()
        if geo_ref is None:
            geo_ref = spawn_georeference()
        log_actor_transform(geo_ref, 'CesiumGeoreference (before origin props)')
        # Only geographic origin — do not set actor rotation/scale/transform here
        try_editor_props(
            geo_ref,
            [
                ('origin_latitude', float(LATITUDE)),
                ('origin_longitude', float(LONGITUDE)),
                ('origin_height', float(ORIGIN_HEIGHT)),
            ],
            'CesiumGeoreference',
        )
        for hprop in ('origin_height', 'OriginHeight'):
            try:
                hv = geo_ref.get_editor_property(hprop)
            except Exception:
                continue
            if hv is None:
                continue
            if float(hv) < 0:
                wwarn('Georeference ' + hprop + ' was negative (' + str(hv) + '); re-applying abs')
                try_editor_props(
                    geo_ref,
                    [('origin_height', abs(float(hv)))],
                    'CesiumGeoreference [height fix]',
                )
            else:
                wlog('Georeference read-back ' + hprop + '=' + str(hv))
            break
        wlog('Georeference origin set (lat/lon/height only).')
        apply_georeference_quality_settings(geo_ref)
        log_actor_transform(geo_ref, 'CesiumGeoreference (after origin props)')
    except Exception:
        log_exc('georeference setup')
        geo_ref = None

    terrain = None
    google_3d = None
    try:
        terrains = find_tileset_by_labels([LABEL_TERRAIN, 'WorldTerrain'])
        if terrains:
            terrain = terrains[0]
            wlog('Reuse terrain tileset label=' + terrain.get_actor_label())
            log_actor_transform(terrain, 'Terrain (reused, before configure)')
        else:
            terrain = spawn_tileset(LABEL_TERRAIN)

        google_list = find_tileset_by_labels(
            [LABEL_GOOGLE_3D, 'GS_WE_OSMBuildings', 'Buildings']
        )
        if google_list:
            google_3d = google_list[0]
            wlog('Reuse Google 3D tileset label=' + google_3d.get_actor_label())
            log_actor_transform(google_3d, 'Google3DTiles (reused, before configure)')
        else:
            google_3d = spawn_tileset(LABEL_GOOGLE_3D)
    except Exception:
        log_exc('tileset find/spawn')

    if terrain:
        try:
            link_georeference(terrain, geo_ref, 'Terrain')
            configure_ion_tileset(terrain, ION_TERRAIN, 'Terrain')
            apply_tileset_quality_settings(terrain, 'Terrain')
            invalidate_georef_cache(terrain, 'Terrain')
            add_bing_imagery_overlay(terrain, 'Terrain')
            call_tileset_refresh(terrain, 'Terrain')
            log_actor_transform(terrain, 'Terrain')
        except Exception:
            log_exc('terrain configure')

    if google_3d:
        try:
            link_georeference(google_3d, geo_ref, 'Google3DTiles')
            configure_ion_tileset(
                google_3d,
                ION_GOOGLE_PHOTOREALISTIC_3D,
                'Google3DTiles',
            )
            apply_tileset_quality_settings(google_3d, 'Google3DTiles')
            invalidate_georef_cache(google_3d, 'Google3DTiles')
            call_tileset_refresh(google_3d, 'Google3DTiles')
            log_actor_transform(google_3d, 'Google3DTiles')
        except Exception:
            log_exc('google 3d tiles configure')

    if hasattr(unreal, 'CesiumSunSky'):
        try:
            sun = None
            for actor in unreal.EditorLevelLibrary.get_all_level_actors():
                try:
                    if actor.get_class().get_name() == 'CesiumSunSky':
                        sun = actor
                        break
                except Exception:
                    pass
            if sun is None:
                sun = spawn_actor_identity(unreal.CesiumSunSky, 'CesiumSunSky')
                sun.set_actor_label('GS_WE_SunSky')
                wlog('Spawned CesiumSunSky')
            else:
                wlog('Found existing CesiumSunSky label=' + str(sun.get_actor_label()))
            log_actor_transform(sun, 'CesiumSunSky')
        except Exception:
            log_exc('SunSky')

    if world:
        try_run_console(None, 'r.Streaming.PoolSize 4096', 'quality')
        try_run_console(None, 'r.Streaming.MaxTempMemoryAllowed 4096', 'quality')
        try_run_console(world, 'log LogTemp Display GrandStudio WorldExplorer Python finished', 'info')

    wlog('=== Import finished for ' + LOCATION_NAME + ' ===')
`;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limit = await checkUsageLimit(user.id, "world_import");
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Daily limit reached for World Explorer imports.",
          limitReached: true,
          used: limit.used,
          limitMax: limit.limit,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { locationName, latitude, longitude, projectId, cesiumIonToken } = body as {
      locationName?: string;
      latitude?: number;
      longitude?: number;
      projectId?: string;
      /** User's Cesium Ion token (preferred). Falls back to server env for demo/testing only. */
      cesiumIonToken?: string;
    };

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }
    if (!locationName?.trim()) {
      return NextResponse.json({ error: "locationName required" }, { status: 400 });
    }
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ error: "latitude and longitude required" }, { status: 400 });
    }

    const userToken =
      typeof cesiumIonToken === "string" ? cesiumIonToken.trim() : "";
    const envToken = process.env.CESIUM_ION_TOKEN?.trim() ?? "";
    const token = userToken || envToken;
    if (!token) {
      return NextResponse.json(
        {
          error:
            "Cesium Ion access token required. Add your token in World Explorer (Beta), or set CESIUM_ION_TOKEN for server-side demo use.",
        },
        { status: 400 }
      );
    }

    const python = buildWorldExplorerPython({
      latitude,
      longitude,
      locationName: locationName.trim(),
      cesiumToken: token,
    });

    const commandId = await queueUE5Command(projectId, python);
    await recordUsage(user.id, "world_import");

    return NextResponse.json({ success: true, commandId });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
