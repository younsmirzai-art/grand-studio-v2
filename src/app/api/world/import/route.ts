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
LABEL_BUILDINGS = 'GS_WE_OSMBuildings'
LABEL_IMAGERY = 'GS_WE_BingImagery'
ION_TERRAIN = 1
ION_BING_AERIAL = 2
ION_OSM_BUILDINGS = 96188


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
    return unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.CesiumGeoreference,
        unreal.Vector(0, 0, 0),
    )


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
    t = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.Cesium3DTileset,
        unreal.Vector(0, 0, 0),
    )
    try:
        t.set_actor_label(label)
        wlog('Tileset spawned: internal_name=' + str(t.get_name()) + ' label=' + str(t.get_actor_label()))
    except Exception as e:
        wwarn('set_actor_label failed: ' + str(e))
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
            unreal.Transform(),
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
        geo_ref = find_georeference()
        if geo_ref is None:
            geo_ref = spawn_georeference()
        try_editor_props(
            geo_ref,
            [
                ('origin_latitude', float(LATITUDE)),
                ('origin_longitude', float(LONGITUDE)),
                ('origin_height', 300.0),
            ],
            'CesiumGeoreference',
        )
        wlog('Georeference origin set (lat/lon/height).')
    except Exception:
        log_exc('georeference setup')
        geo_ref = None

    terrain = None
    buildings = None
    try:
        terrains = find_tileset_by_labels([LABEL_TERRAIN, 'WorldTerrain'])
        if terrains:
            terrain = terrains[0]
            wlog('Reuse terrain tileset label=' + terrain.get_actor_label())
        else:
            terrain = spawn_tileset(LABEL_TERRAIN)

        buildings_list = find_tileset_by_labels([LABEL_BUILDINGS, 'Buildings'])
        if buildings_list:
            buildings = buildings_list[0]
            wlog('Reuse buildings tileset label=' + buildings.get_actor_label())
        else:
            buildings = spawn_tileset(LABEL_BUILDINGS)
    except Exception:
        log_exc('tileset find/spawn')

    if terrain:
        try:
            link_georeference(terrain, geo_ref, 'Terrain')
            configure_ion_tileset(terrain, ION_TERRAIN, 'Terrain')
            try:
                terrain.set_editor_property('maximum_screen_space_error', 16.0)
                wlog('Terrain: maximum_screen_space_error=16')
            except Exception as e:
                wlog('Terrain: MSE property: ' + str(e))
            invalidate_georef_cache(terrain, 'Terrain')
            add_bing_imagery_overlay(terrain, 'Terrain')
            call_tileset_refresh(terrain, 'Terrain')
        except Exception:
            log_exc('terrain configure')

    if buildings:
        try:
            link_georeference(buildings, geo_ref, 'Buildings')
            configure_ion_tileset(buildings, ION_OSM_BUILDINGS, 'Buildings')
            try:
                buildings.set_editor_property('maximum_screen_space_error', 8.0)
                wlog('Buildings: maximum_screen_space_error=8 (show finer detail)')
            except Exception as e:
                wlog('Buildings: MSE property: ' + str(e))
            invalidate_georef_cache(buildings, 'Buildings')
            call_tileset_refresh(buildings, 'Buildings')
        except Exception:
            log_exc('buildings configure')

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
                sun = unreal.EditorLevelLibrary.spawn_actor_from_class(
                    unreal.CesiumSunSky,
                    unreal.Vector(0, 0, 0),
                )
                sun.set_actor_label('GS_WE_SunSky')
                wlog('Spawned CesiumSunSky')
            else:
                wlog('Found existing CesiumSunSky label=' + str(sun.get_actor_label()))
        except Exception:
            log_exc('SunSky')

    if world:
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
    const { locationName, latitude, longitude, projectId } = body as {
      locationName?: string;
      latitude?: number;
      longitude?: number;
      projectId?: string;
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

    const token = process.env.CESIUM_ION_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "CESIUM_ION_TOKEN is not configured" },
        { status: 500 }
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
