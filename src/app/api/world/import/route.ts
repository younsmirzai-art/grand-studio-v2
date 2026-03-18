import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";
import { queueUE5Command } from "@/lib/ue5/commands";

function escapePyString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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

    const safeName = escapePyString(locationName.trim());
    const safeToken = escapePyString(token);

    const python = `import unreal

LATITUDE = ${latitude}
LONGITUDE = ${longitude}
LOCATION_NAME = '${safeName}'
CESIUM_TOKEN = '${safeToken}'

unreal.log(f'World Explorer: Import started for {LOCATION_NAME} ({LATITUDE}, {LONGITUDE})')

# Basic plugin availability check
if not hasattr(unreal, 'CesiumGeoreference') or not hasattr(unreal, 'Cesium3DTileset'):
    unreal.log_error('World Explorer: Required geospatial plugin classes not found. Install/enable the World Explorer plugin and restart UE5.')
else:
    # Find or create Georeference
    geo_ref = None
    for actor in unreal.EditorLevelLibrary.get_all_level_actors():
        try:
            if actor.get_class().get_name() == 'CesiumGeoreference':
                geo_ref = actor
                break
        except Exception:
            pass
    if geo_ref is None:
        geo_ref = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.CesiumGeoreference, unreal.Vector(0, 0, 0))
    try:
        geo_ref.set_editor_property('origin_latitude', float(LATITUDE))
        geo_ref.set_editor_property('origin_longitude', float(LONGITUDE))
        geo_ref.set_editor_property('origin_height', 300.0)
    except Exception as e:
        unreal.log_warning(f'World Explorer: Could not set georeference origin: {e}')

    # Add Terrain tileset (Asset ID 1)
    terrain = None
    for actor in unreal.EditorLevelLibrary.get_all_level_actors():
        if 'WorldTerrain' in actor.get_name():
            terrain = actor
            break
    if terrain is None:
        terrain = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.Cesium3DTileset, unreal.Vector(0, 0, 0))
        terrain.set_actor_label('WorldTerrain')
    try:
        terrain.set_editor_property('ion_asset_id', 1)
        terrain.set_editor_property('ion_access_token', CESIUM_TOKEN)
    except Exception as e:
        unreal.log_warning(f'World Explorer: Could not configure terrain tileset: {e}')

    # Add Buildings tileset (Asset ID 96188)
    buildings = None
    for actor in unreal.EditorLevelLibrary.get_all_level_actors():
        if 'Buildings' in actor.get_name():
            buildings = actor
            break
    if buildings is None:
        buildings = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.Cesium3DTileset, unreal.Vector(0, 0, 0))
        buildings.set_actor_label('Buildings')
    try:
        buildings.set_editor_property('ion_asset_id', 96188)
        buildings.set_editor_property('ion_access_token', CESIUM_TOKEN)
    except Exception as e:
        unreal.log_warning(f'World Explorer: Could not configure buildings tileset: {e}')

    # Add Sun/Sky actor if available
    if hasattr(unreal, 'CesiumSunSky'):
        sun = None
        for actor in unreal.EditorLevelLibrary.get_all_level_actors():
            if actor.get_class().get_name() == 'CesiumSunSky':
                sun = actor
                break
        if sun is None:
            sun = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.CesiumSunSky, unreal.Vector(0, 0, 0))
            try:
                sun.set_actor_label('WorldExplorerSunSky')
            except Exception:
                pass

    unreal.log(f'World Explorer: Loaded {LOCATION_NAME} at {LATITUDE}, {LONGITUDE}')
`;

    const commandId = await queueUE5Command(projectId, python);
    await recordUsage(user.id, "world_import");

    return NextResponse.json({ success: true, commandId });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

