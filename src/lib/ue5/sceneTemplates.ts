export interface SceneTemplate {
  name: string;
  description: string;
  keywords: string[];
  code: string;
}

export const SCENE_TEMPLATES: Record<string, SceneTemplate> = {
  medieval_house: {
    name: "Medieval House",
    description:
      "A medieval-style house with walls, roof, door, trees, and lighting",
    keywords: ["house", "home", "medieval", "cottage", "cabin", "hut"],
    code: `
import unreal

el = unreal.EditorLevelLibrary

def load_mesh(path):
    return unreal.EditorAssetLibrary.load_asset(path)

def load_mat(path):
    return unreal.EditorAssetLibrary.load_asset(path)

def make_color(r, g, b):
    base = load_mat('/Engine/BasicShapes/BasicShapeMaterial')
    if base:
        world = el.get_editor_world()
        dmi = unreal.KismetMaterialLibrary.create_dynamic_material_instance(world, base)
        dmi.set_vector_parameter_value('Color', unreal.LinearColor(r, g, b, 1.0))
        return dmi
    return None

def spawn_mesh(pos, mesh_path, scale, label, mat_path=None, color=None):
    actor = el.spawn_actor_from_class(unreal.StaticMeshActor, pos)
    mesh = actor.get_component_by_class(unreal.StaticMeshComponent)
    m = load_mesh(mesh_path)
    if m:
        mesh.set_static_mesh(m)
    actor.set_actor_scale3d(scale)
    actor.set_actor_label(label)
    if mat_path:
        mat = load_mat(mat_path)
        if mat:
            mesh.set_material(0, mat)
    elif color:
        dmi = make_color(*color)
        if dmi:
            mesh.set_material(0, dmi)
    return actor

try:
    sky = el.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0,0,0))
    sky.set_actor_label('Sky')
    sun = el.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0,0,0))
    sun.set_actor_rotation(unreal.Rotator(-40, -30, 0), False)
    lc = sun.get_component_by_class(unreal.DirectionalLightComponent)
    if lc:
        lc.set_editor_property('intensity', 8.0)
        lc.set_editor_property('light_color', unreal.Color(255, 230, 200, 255))
    sun.set_actor_label('Sun')
    sky_light = el.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0,0,0))
    slc = sky_light.get_component_by_class(unreal.SkyLightComponent)
    if slc:
        slc.set_editor_property('intensity', 1.5)
    sky_light.set_actor_label('SkyLight')
    fog = el.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0,0,0))
    fc = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
    if fc:
        fc.set_editor_property('fog_density', 0.01)
    fog.set_actor_label('Fog')

    ground = spawn_mesh(unreal.Vector(0, 0, -5), '/Engine/BasicShapes/Plane',
        unreal.Vector(50, 50, 1), 'Ground', color=(0.15, 0.5, 0.1))

    spawn_mesh(unreal.Vector(0, 0, 5), '/Engine/BasicShapes/Cube',
        unreal.Vector(6, 6, 0.1), 'House_Floor', color=(0.45, 0.25, 0.1))

    spawn_mesh(unreal.Vector(0, -295, 160), '/Engine/BasicShapes/Cube',
        unreal.Vector(6, 0.2, 3.2), 'Wall_Front', color=(0.7, 0.55, 0.35))
    spawn_mesh(unreal.Vector(0, 295, 160), '/Engine/BasicShapes/Cube',
        unreal.Vector(6, 0.2, 3.2), 'Wall_Back', color=(0.7, 0.55, 0.35))
    spawn_mesh(unreal.Vector(-295, 0, 160), '/Engine/BasicShapes/Cube',
        unreal.Vector(0.2, 6, 3.2), 'Wall_Left', color=(0.7, 0.55, 0.35))
    spawn_mesh(unreal.Vector(295, 0, 160), '/Engine/BasicShapes/Cube',
        unreal.Vector(0.2, 6, 3.2), 'Wall_Right', color=(0.7, 0.55, 0.35))

    spawn_mesh(unreal.Vector(0, 0, 380), '/Engine/BasicShapes/Cone',
        unreal.Vector(7, 7, 2.5), 'Roof', color=(0.3, 0.12, 0.05))

    spawn_mesh(unreal.Vector(100, -296, 100), '/Engine/BasicShapes/Cube',
        unreal.Vector(1.2, 0.05, 2.1), 'Door', color=(0.2, 0.1, 0.05))

    tree_positions = [(-1200, -800), (-1400, 400), (-900, 1200), (200, 1300), (1200, 900), (1400, -200), (1000, -1100), (-300, -1200)]
    for i, (tx, ty) in enumerate(tree_positions):
        spawn_mesh(unreal.Vector(tx, ty, 200), '/Engine/BasicShapes/Cylinder',
            unreal.Vector(0.4, 0.4, 4.5), f'Tree_Trunk_{i}', color=(0.35, 0.2, 0.08))
        spawn_mesh(unreal.Vector(tx, ty, 550), '/Engine/BasicShapes/Sphere',
            unreal.Vector(3.5, 3.5, 3.0), f'Tree_Canopy_{i}', color=(0.1, 0.45, 0.08))

    for i in range(8):
        spawn_mesh(unreal.Vector(100, -300 - i*150, 3), '/Engine/BasicShapes/Cube',
            unreal.Vector(1, 0.8, 0.05), f'PathStone_{i}', color=(0.5, 0.5, 0.5))

    interior_light = el.spawn_actor_from_class(unreal.PointLight, unreal.Vector(0, 0, 280))
    plc = interior_light.get_component_by_class(unreal.PointLightComponent)
    if plc:
        plc.set_editor_property('intensity', 5000)
        plc.set_editor_property('light_color', unreal.Color(255, 200, 140, 255))
        plc.set_editor_property('attenuation_radius', 800)
    interior_light.set_actor_label('Light_Interior')

    for side in [-250, 250]:
        torch = el.spawn_actor_from_class(unreal.PointLight, unreal.Vector(side, -350, 250))
        tc = torch.get_component_by_class(unreal.PointLightComponent)
        if tc:
            tc.set_editor_property('intensity', 3000)
            tc.set_editor_property('light_color', unreal.Color(255, 150, 50, 255))
            tc.set_editor_property('attenuation_radius', 600)
        torch.set_actor_label(f'Torch_{side}')

    pp = el.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0,0,0))
    pp.set_actor_scale3d(unreal.Vector(500, 500, 500))
    pp.set_editor_property('unbound', True)
    pp.set_actor_label('PostProcess')

    el.set_level_viewport_camera_info(
        unreal.Vector(-2000, -2000, 1200),
        unreal.Rotator(-30, 45, 0)
    )

    unreal.log('Medieval house scene complete')
except Exception as e:
    unreal.log_error(str(e))
`.trim(),
  },

  castle: {
    name: "Castle",
    description: "A castle with towers, walls, gate, and courtyard",
    keywords: ["castle", "fortress", "kingdom", "tower", "medieval castle"],
    code: `
import unreal
import random

el = unreal.EditorLevelLibrary

def load_mesh(path):
    return unreal.EditorAssetLibrary.load_asset(path)

def load_mat(path):
    return unreal.EditorAssetLibrary.load_asset(path)

def make_color(r, g, b):
    base = load_mat('/Engine/BasicShapes/BasicShapeMaterial')
    if base:
        world = el.get_editor_world()
        dmi = unreal.KismetMaterialLibrary.create_dynamic_material_instance(world, base)
        dmi.set_vector_parameter_value('Color', unreal.LinearColor(r, g, b, 1.0))
        return dmi
    return None

def spawn_mesh(pos, mesh_path, scale, label, mat_path=None, color=None):
    actor = el.spawn_actor_from_class(unreal.StaticMeshActor, pos)
    mesh = actor.get_component_by_class(unreal.StaticMeshComponent)
    m = load_mesh(mesh_path)
    if m:
        mesh.set_static_mesh(m)
    actor.set_actor_scale3d(scale)
    actor.set_actor_label(label)
    if mat_path:
        mat = load_mat(mat_path)
        if mat:
            mesh.set_material(0, mat)
    elif color:
        dmi = make_color(*color)
        if dmi:
            mesh.set_material(0, dmi)
    return actor

try:
    sky = el.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0,0,0))
    sky.set_actor_label('Sky')
    sun = el.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0,0,0))
    sun.set_actor_rotation(unreal.Rotator(-35, -45, 0), False)
    lc = sun.get_component_by_class(unreal.DirectionalLightComponent)
    if lc:
        lc.set_editor_property('intensity', 8.0)
        lc.set_editor_property('light_color', unreal.Color(255, 220, 180, 255))
    sun.set_actor_label('Sun')
    sky_light = el.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0,0,0))
    slc = sky_light.get_component_by_class(unreal.SkyLightComponent)
    if slc:
        slc.set_editor_property('intensity', 1.2)
    sky_light.set_actor_label('SkyLight')
    fog = el.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0,0,0))
    fc = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
    if fc:
        fc.set_editor_property('fog_density', 0.008)
    fog.set_actor_label('Fog')

    ground = spawn_mesh(unreal.Vector(0, 0, -5), '/Engine/BasicShapes/Plane',
        unreal.Vector(50, 50, 1), 'Ground', mat_path='/Game/StarterContent/Materials/M_Ground_Grass')

    courtyard = spawn_mesh(unreal.Vector(0, 0, 2), '/Engine/BasicShapes/Plane',
        unreal.Vector(18, 18, 1), 'Courtyard', mat_path='/Game/StarterContent/Materials/M_CobbleStone_Smooth')

    tower_positions = [(-800, -800), (800, -800), (800, 800), (-800, 800)]
    for i, (tx, ty) in enumerate(tower_positions):
        spawn_mesh(unreal.Vector(tx, ty, 400), '/Engine/BasicShapes/Cylinder',
            unreal.Vector(1.5, 1.5, 8), f'Tower_{i}', mat_path='/Game/StarterContent/Materials/M_Rock_Slate')
        spawn_mesh(unreal.Vector(tx, ty, 880), '/Engine/BasicShapes/Cone',
            unreal.Vector(2.2, 2.2, 1.8), f'TowerRoof_{i}', color=(0.4, 0.1, 0.1))
        spawn_mesh(unreal.Vector(tx, ty, 960), '/Engine/BasicShapes/Cylinder',
            unreal.Vector(0.08, 0.08, 1.5), f'Flagpole_{i}', color=(0.3, 0.2, 0.1))
        spawn_mesh(unreal.Vector(tx + 10, ty, 1030), '/Engine/BasicShapes/Cube',
            unreal.Vector(0.5, 0.02, 0.3), f'Banner_{i}', color=(0.7, 0.1, 0.1))

    spawn_mesh(unreal.Vector(0, -800, 200), '/Engine/BasicShapes/Cube',
        unreal.Vector(10, 0.3, 4), 'Wall_Front_Left', mat_path='/Game/StarterContent/Materials/M_Rock_Slate')
    spawn_mesh(unreal.Vector(0, 800, 200), '/Engine/BasicShapes/Cube',
        unreal.Vector(10, 0.3, 4), 'Wall_Back', mat_path='/Game/StarterContent/Materials/M_Rock_Slate')
    spawn_mesh(unreal.Vector(-800, 0, 200), '/Engine/BasicShapes/Cube',
        unreal.Vector(0.3, 10, 4), 'Wall_Left', mat_path='/Game/StarterContent/Materials/M_Rock_Slate')
    spawn_mesh(unreal.Vector(800, 0, 200), '/Engine/BasicShapes/Cube',
        unreal.Vector(0.3, 10, 4), 'Wall_Right', mat_path='/Game/StarterContent/Materials/M_Rock_Slate')

    spawn_mesh(unreal.Vector(-200, -800, 200), '/Engine/BasicShapes/Cube',
        unreal.Vector(0.4, 0.4, 5), 'GatePillar_L', mat_path='/Game/StarterContent/Materials/M_Rock_Slate')
    spawn_mesh(unreal.Vector(200, -800, 200), '/Engine/BasicShapes/Cube',
        unreal.Vector(0.4, 0.4, 5), 'GatePillar_R', mat_path='/Game/StarterContent/Materials/M_Rock_Slate')
    spawn_mesh(unreal.Vector(0, -800, 450), '/Engine/BasicShapes/Cube',
        unreal.Vector(2.5, 0.3, 0.5), 'GateArch', mat_path='/Game/StarterContent/Materials/M_Rock_Slate')

    torch_spots = [(-400, -800, 250), (400, -800, 250), (-800, -400, 250), (-800, 400, 250),
                   (800, -400, 250), (800, 400, 250), (-400, 800, 250), (400, 800, 250)]
    for i, (tx, ty, tz) in enumerate(torch_spots):
        torch = el.spawn_actor_from_class(unreal.PointLight, unreal.Vector(tx, ty, tz))
        tc = torch.get_component_by_class(unreal.PointLightComponent)
        if tc:
            tc.set_editor_property('intensity', 4000)
            tc.set_editor_property('light_color', unreal.Color(255, 160, 60, 255))
            tc.set_editor_property('attenuation_radius', 500)
        torch.set_actor_label(f'Torch_{i}')
        spawn_mesh(unreal.Vector(tx, ty, 150), '/Engine/BasicShapes/Cylinder',
            unreal.Vector(0.06, 0.06, 1.5), f'TorchPole_{i}', color=(0.25, 0.15, 0.05))

    spawn_mesh(unreal.Vector(0, 0, 50), '/Engine/BasicShapes/Cylinder',
        unreal.Vector(1.2, 1.2, 0.5), 'Well_Base', mat_path='/Game/StarterContent/Materials/M_CobbleStone_Smooth')
    spawn_mesh(unreal.Vector(0, 0, 120), '/Engine/BasicShapes/Cylinder',
        unreal.Vector(0.8, 0.8, 0.8), 'Well_Wall', mat_path='/Game/StarterContent/Materials/M_Rock_Slate')

    pp = el.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0,0,0))
    pp.set_actor_scale3d(unreal.Vector(500, 500, 500))
    pp.set_editor_property('unbound', True)
    pp.set_actor_label('PostProcess')

    el.set_level_viewport_camera_info(
        unreal.Vector(-2500, -2500, 1800),
        unreal.Rotator(-30, 45, 0)
    )

    unreal.log('Castle scene complete: 4 towers, walls, gate, courtyard, torches')
except Exception as e:
    unreal.log_error(str(e))
`.trim(),
  },

  city_block: {
    name: "City Block",
    description: "Modern city block with buildings, roads, and street lights",
    keywords: ["city", "urban", "building", "skyscraper", "downtown", "street"],
    code: `
import unreal
import random

el = unreal.EditorLevelLibrary

def load_mesh(path):
    return unreal.EditorAssetLibrary.load_asset(path)

def load_mat(path):
    return unreal.EditorAssetLibrary.load_asset(path)

def make_color(r, g, b):
    base = load_mat('/Engine/BasicShapes/BasicShapeMaterial')
    if base:
        world = el.get_editor_world()
        dmi = unreal.KismetMaterialLibrary.create_dynamic_material_instance(world, base)
        dmi.set_vector_parameter_value('Color', unreal.LinearColor(r, g, b, 1.0))
        return dmi
    return None

def spawn_mesh(pos, mesh_path, scale, label, mat_path=None, color=None, rot=None):
    actor = el.spawn_actor_from_class(unreal.StaticMeshActor, pos)
    mesh = actor.get_component_by_class(unreal.StaticMeshComponent)
    m = load_mesh(mesh_path)
    if m:
        mesh.set_static_mesh(m)
    actor.set_actor_scale3d(scale)
    actor.set_actor_label(label)
    if rot:
        actor.set_actor_rotation(rot, False)
    if mat_path:
        mat = load_mat(mat_path)
        if mat:
            mesh.set_material(0, mat)
    elif color:
        dmi = make_color(*color)
        if dmi:
            mesh.set_material(0, dmi)
    return actor

try:
    sky = el.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0,0,0))
    sky.set_actor_label('Sky')
    sun = el.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0,0,0))
    sun.set_actor_rotation(unreal.Rotator(-15, -60, 0), False)
    lc = sun.get_component_by_class(unreal.DirectionalLightComponent)
    if lc:
        lc.set_editor_property('intensity', 2.0)
        lc.set_editor_property('light_color', unreal.Color(100, 120, 180, 255))
    sun.set_actor_label('Moon')
    sky_light = el.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0,0,0))
    slc = sky_light.get_component_by_class(unreal.SkyLightComponent)
    if slc:
        slc.set_editor_property('intensity', 0.4)
    sky_light.set_actor_label('SkyLight')
    fog = el.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0,0,0))
    fc = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
    if fc:
        fc.set_editor_property('fog_density', 0.015)
    fog.set_actor_label('Fog')

    ground = spawn_mesh(unreal.Vector(0, 0, -5), '/Engine/BasicShapes/Plane',
        unreal.Vector(50, 50, 1), 'Ground', color=(0.12, 0.12, 0.14))

    spawn_mesh(unreal.Vector(0, 0, 2), '/Engine/BasicShapes/Plane',
        unreal.Vector(30, 4, 1), 'Road', mat_path='/Game/StarterContent/Materials/M_Concrete_Poured')
    spawn_mesh(unreal.Vector(0, 250, 3), '/Engine/BasicShapes/Plane',
        unreal.Vector(30, 1.2, 1), 'Sidewalk_L', color=(0.45, 0.45, 0.45))
    spawn_mesh(unreal.Vector(0, -250, 3), '/Engine/BasicShapes/Plane',
        unreal.Vector(30, 1.2, 1), 'Sidewalk_R', color=(0.45, 0.45, 0.45))

    for cx in range(-2, 3):
        spawn_mesh(unreal.Vector(cx * 300, 0, 4), '/Engine/BasicShapes/Cube',
            unreal.Vector(1.2, 0.15, 0.02), f'Crosswalk_{cx}', color=(0.95, 0.95, 0.95))

    buildings = [
        (-1200, 600,  800, (0.35, 0.4, 0.5)),
        (-500,  600,  1200, (0.25, 0.25, 0.3)),
        (300,   600,  600,  (0.5, 0.35, 0.3)),
        (1000,  600,  1000, (0.3, 0.3, 0.35)),
        (-800,  -600, 900,  (0.4, 0.38, 0.45)),
        (500,   -600, 700,  (0.5, 0.5, 0.55)),
    ]
    for i, (bx, by, bh, bc) in enumerate(buildings):
        spawn_mesh(unreal.Vector(bx, by, bh/2), '/Engine/BasicShapes/Cube',
            unreal.Vector(3.5, 3.5, bh/100.0), f'Building_{i}', color=bc)
        rows = int(bh / 150)
        for wy in range(rows):
            for wx in range(-1, 2):
                wc = random.choice([(0.9, 0.85, 0.4), (0.2, 0.5, 0.8), (0.15, 0.15, 0.2)])
                spawn_mesh(unreal.Vector(bx + wx * 80, by - 175, 100 + wy * 150),
                    '/Engine/BasicShapes/Cube',
                    unreal.Vector(0.5, 0.02, 0.4), f'Window_B{i}_{wy}_{wx}', color=wc)

    light_positions = [-1400, -700, 0, 700, 1400]
    for i, lx in enumerate(light_positions):
        for side in [-350, 350]:
            spawn_mesh(unreal.Vector(lx, side, 200), '/Engine/BasicShapes/Cylinder',
                unreal.Vector(0.08, 0.08, 4), f'LightPole_{i}_{side}', color=(0.3, 0.3, 0.3))
            sl = el.spawn_actor_from_class(unreal.PointLight, unreal.Vector(lx, side, 420))
            plc = sl.get_component_by_class(unreal.PointLightComponent)
            if plc:
                plc.set_editor_property('intensity', 8000)
                plc.set_editor_property('light_color', unreal.Color(255, 220, 150, 255))
                plc.set_editor_property('attenuation_radius', 700)
            sl.set_actor_label(f'StreetLight_{i}_{side}')

    car_data = [
        (-400, -80, (0.8, 0.1, 0.1)),
        (600, 80, (0.1, 0.2, 0.8)),
    ]
    for ci, (cx, cy, cc) in enumerate(car_data):
        spawn_mesh(unreal.Vector(cx, cy, 40), '/Engine/BasicShapes/Cube',
            unreal.Vector(2.0, 1.0, 0.6), f'CarBody_{ci}', color=cc)
        spawn_mesh(unreal.Vector(cx, cy, 75), '/Engine/BasicShapes/Cube',
            unreal.Vector(1.0, 0.8, 0.5), f'CarCabin_{ci}', color=(0.15, 0.15, 0.2))
        for wx, wy in [(-60, -55), (-60, 55), (60, -55), (60, 55)]:
            spawn_mesh(unreal.Vector(cx + wx, cy + wy, 20), '/Engine/BasicShapes/Cylinder',
                unreal.Vector(0.25, 0.25, 0.12), f'Wheel_{ci}_{wx}_{wy}', color=(0.1, 0.1, 0.1))

    neon_colors = [(1.0, 0.0, 0.4), (0.0, 0.8, 1.0), (1.0, 0.6, 0.0)]
    for ni, nc in enumerate(neon_colors):
        nl = el.spawn_actor_from_class(unreal.PointLight, unreal.Vector(-500 + ni * 500, 420, 300))
        nlc = nl.get_component_by_class(unreal.PointLightComponent)
        if nlc:
            nlc.set_editor_property('intensity', 5000)
            nlc.set_editor_property('light_color', unreal.Color(int(nc[0]*255), int(nc[1]*255), int(nc[2]*255), 255))
            nlc.set_editor_property('attenuation_radius', 500)
        nl.set_actor_label(f'NeonLight_{ni}')

    pp = el.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0,0,0))
    pp.set_actor_scale3d(unreal.Vector(500, 500, 500))
    pp.set_editor_property('unbound', True)
    pp.set_actor_label('PostProcess')

    el.set_level_viewport_camera_info(
        unreal.Vector(-2000, -800, 600),
        unreal.Rotator(-15, 25, 0)
    )

    unreal.log('City block scene complete: 6 buildings, road, street lights, 2 cars, neon')
except Exception as e:
    unreal.log_error(str(e))
`.trim(),
  },

  forest: {
    name: "Forest",
    description: "Dense forest with various trees, rocks, and a clearing",
    keywords: ["forest", "woods", "jungle", "nature", "wilderness"],
    code: `
import unreal
import random

el = unreal.EditorLevelLibrary
random.seed(42)

def load_mesh(path):
    return unreal.EditorAssetLibrary.load_asset(path)

def load_mat(path):
    return unreal.EditorAssetLibrary.load_asset(path)

def make_color(r, g, b):
    base = load_mat('/Engine/BasicShapes/BasicShapeMaterial')
    if base:
        world = el.get_editor_world()
        dmi = unreal.KismetMaterialLibrary.create_dynamic_material_instance(world, base)
        dmi.set_vector_parameter_value('Color', unreal.LinearColor(r, g, b, 1.0))
        return dmi
    return None

def spawn_mesh(pos, mesh_path, scale, label, mat_path=None, color=None):
    actor = el.spawn_actor_from_class(unreal.StaticMeshActor, pos)
    mesh = actor.get_component_by_class(unreal.StaticMeshComponent)
    m = load_mesh(mesh_path)
    if m:
        mesh.set_static_mesh(m)
    actor.set_actor_scale3d(scale)
    actor.set_actor_label(label)
    if mat_path:
        mat = load_mat(mat_path)
        if mat:
            mesh.set_material(0, mat)
    elif color:
        dmi = make_color(*color)
        if dmi:
            mesh.set_material(0, dmi)
    return actor

try:
    sky = el.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0,0,0))
    sky.set_actor_label('Sky')
    sun = el.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0,0,0))
    sun.set_actor_rotation(unreal.Rotator(-50, 30, 0), False)
    lc = sun.get_component_by_class(unreal.DirectionalLightComponent)
    if lc:
        lc.set_editor_property('intensity', 5.0)
        lc.set_editor_property('light_color', unreal.Color(200, 230, 180, 255))
    sun.set_actor_label('Sun')
    sky_light = el.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0,0,0))
    slc = sky_light.get_component_by_class(unreal.SkyLightComponent)
    if slc:
        slc.set_editor_property('intensity', 1.8)
    sky_light.set_actor_label('SkyLight')
    fog = el.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0,0,0))
    fc = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
    if fc:
        fc.set_editor_property('fog_density', 0.03)
    fog.set_actor_label('Fog')

    ground = spawn_mesh(unreal.Vector(0, 0, -5), '/Engine/BasicShapes/Plane',
        unreal.Vector(50, 50, 1), 'Ground', mat_path='/Game/StarterContent/Materials/M_Ground_Grass')

    clearing_radius = 400
    tree_count = 0
    for i in range(30):
        tx = random.uniform(-2500, 2500)
        ty = random.uniform(-2500, 2500)
        dist = (tx**2 + ty**2) ** 0.5
        if dist < clearing_radius:
            continue
        trunk_h = random.uniform(3.5, 6.0)
        trunk_w = random.uniform(0.25, 0.5)
        canopy_s = random.uniform(2.5, 4.5)
        green_r = random.uniform(0.05, 0.2)
        green_g = random.uniform(0.3, 0.6)
        green_b = random.uniform(0.02, 0.15)
        spawn_mesh(unreal.Vector(tx, ty, trunk_h * 50),
            '/Engine/BasicShapes/Cylinder',
            unreal.Vector(trunk_w, trunk_w, trunk_h),
            f'Trunk_{tree_count}', color=(0.3 + random.uniform(-0.05, 0.05), 0.18, 0.06))
        spawn_mesh(unreal.Vector(tx, ty, trunk_h * 100 + 80),
            '/Engine/BasicShapes/Sphere',
            unreal.Vector(canopy_s, canopy_s, canopy_s * 0.8),
            f'Canopy_{tree_count}', color=(green_r, green_g, green_b))
        tree_count += 1

    for i in range(12):
        rx = random.uniform(-2200, 2200)
        ry = random.uniform(-2200, 2200)
        rs = random.uniform(0.5, 2.0)
        spawn_mesh(unreal.Vector(rx, ry, rs * 15),
            '/Engine/BasicShapes/Sphere',
            unreal.Vector(rs, rs, rs * 0.6),
            f'Rock_{i}', mat_path='/Game/StarterContent/Materials/M_Rock_Slate')

    for i in range(8):
        bx = random.uniform(-2000, 2000)
        by = random.uniform(-2000, 2000)
        dist = (bx**2 + by**2) ** 0.5
        if dist < clearing_radius:
            continue
        bs = random.uniform(0.8, 1.8)
        spawn_mesh(unreal.Vector(bx, by, bs * 20),
            '/Engine/BasicShapes/Sphere',
            unreal.Vector(bs, bs, bs * 0.7),
            f'Bush_{i}', color=(0.08, random.uniform(0.3, 0.5), 0.05))

    clearing_light = el.spawn_actor_from_class(unreal.PointLight, unreal.Vector(0, 0, 300))
    clc = clearing_light.get_component_by_class(unreal.PointLightComponent)
    if clc:
        clc.set_editor_property('intensity', 3000)
        clc.set_editor_property('light_color', unreal.Color(220, 255, 180, 255))
        clc.set_editor_property('attenuation_radius', 800)
    clearing_light.set_actor_label('ClearingLight')

    spawn_mesh(unreal.Vector(0, 0, 15), '/Engine/BasicShapes/Cylinder',
        unreal.Vector(0.6, 0.6, 0.3), 'TreeStump', color=(0.35, 0.2, 0.08))

    spawn_mesh(unreal.Vector(150, 80, 5), '/Engine/BasicShapes/Cube',
        unreal.Vector(0.6, 0.3, 0.02), 'FallenLog', color=(0.3, 0.18, 0.06))

    pp = el.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0,0,0))
    pp.set_actor_scale3d(unreal.Vector(500, 500, 500))
    pp.set_editor_property('unbound', True)
    pp.set_actor_label('PostProcess')

    el.set_level_viewport_camera_info(
        unreal.Vector(-3000, -1500, 1000),
        unreal.Rotator(-20, 30, 0)
    )

    unreal.log(f'Forest scene complete: {tree_count} trees, 12 rocks, 8 bushes, clearing')
except Exception as e:
    unreal.log_error(str(e))
`.trim(),
  },

  island: {
    name: "Island",
    description: "Tropical island with beach, palm trees, and ocean",
    keywords: ["island", "beach", "ocean", "tropical", "sea"],
    code: `
import unreal
import random
import math

el = unreal.EditorLevelLibrary
random.seed(7)

def load_mesh(path):
    return unreal.EditorAssetLibrary.load_asset(path)

def load_mat(path):
    return unreal.EditorAssetLibrary.load_asset(path)

def make_color(r, g, b):
    base = load_mat('/Engine/BasicShapes/BasicShapeMaterial')
    if base:
        world = el.get_editor_world()
        dmi = unreal.KismetMaterialLibrary.create_dynamic_material_instance(world, base)
        dmi.set_vector_parameter_value('Color', unreal.LinearColor(r, g, b, 1.0))
        return dmi
    return None

def spawn_mesh(pos, mesh_path, scale, label, mat_path=None, color=None, rot=None):
    actor = el.spawn_actor_from_class(unreal.StaticMeshActor, pos)
    mesh = actor.get_component_by_class(unreal.StaticMeshComponent)
    m = load_mesh(mesh_path)
    if m:
        mesh.set_static_mesh(m)
    actor.set_actor_scale3d(scale)
    actor.set_actor_label(label)
    if rot:
        actor.set_actor_rotation(rot, False)
    if mat_path:
        mat = load_mat(mat_path)
        if mat:
            mesh.set_material(0, mat)
    elif color:
        dmi = make_color(*color)
        if dmi:
            mesh.set_material(0, dmi)
    return actor

try:
    sky = el.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0,0,0))
    sky.set_actor_label('Sky')
    sun = el.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0,0,0))
    sun.set_actor_rotation(unreal.Rotator(-45, 20, 0), False)
    lc = sun.get_component_by_class(unreal.DirectionalLightComponent)
    if lc:
        lc.set_editor_property('intensity', 10.0)
        lc.set_editor_property('light_color', unreal.Color(255, 240, 210, 255))
    sun.set_actor_label('Sun')
    sky_light = el.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0,0,0))
    slc = sky_light.get_component_by_class(unreal.SkyLightComponent)
    if slc:
        slc.set_editor_property('intensity', 2.0)
    sky_light.set_actor_label('SkyLight')
    fog = el.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0,0,0))
    fc = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
    if fc:
        fc.set_editor_property('fog_density', 0.005)
    fog.set_actor_label('Fog')

    ocean = spawn_mesh(unreal.Vector(0, 0, -20), '/Engine/BasicShapes/Plane',
        unreal.Vector(50, 50, 1), 'Ocean', mat_path='/Game/StarterContent/Materials/M_Water_Lake')

    spawn_mesh(unreal.Vector(0, 0, 30), '/Engine/BasicShapes/Sphere',
        unreal.Vector(14, 14, 1.5), 'IslandBase', color=(0.85, 0.75, 0.55))

    spawn_mesh(unreal.Vector(0, 0, 70), '/Engine/BasicShapes/Plane',
        unreal.Vector(12, 12, 1), 'IslandTop', mat_path='/Game/StarterContent/Materials/M_Ground_Grass')

    spawn_mesh(unreal.Vector(0, 0, 50), '/Engine/BasicShapes/Plane',
        unreal.Vector(15, 15, 1), 'Beach', color=(0.92, 0.85, 0.6))

    palm_spots = []
    for i in range(8):
        angle = random.uniform(0, 2 * math.pi)
        dist = random.uniform(300, 900)
        px = math.cos(angle) * dist
        py = math.sin(angle) * dist
        palm_spots.append((px, py))
        lean_angle = random.uniform(5, 20)
        lean_dir = random.uniform(0, 360)
        trunk_h = random.uniform(3.5, 5.5)
        spawn_mesh(unreal.Vector(px, py, trunk_h * 40 + 70),
            '/Engine/BasicShapes/Cylinder',
            unreal.Vector(0.2, 0.2, trunk_h),
            f'PalmTrunk_{i}',
            color=(0.45, 0.3, 0.15),
            rot=unreal.Rotator(lean_angle, lean_dir, 0))
        cx = px + math.cos(math.radians(lean_dir)) * lean_angle * 3
        cy = py + math.sin(math.radians(lean_dir)) * lean_angle * 3
        spawn_mesh(unreal.Vector(cx, cy, trunk_h * 80 + 100),
            '/Engine/BasicShapes/Sphere',
            unreal.Vector(2.5, 1.5, 1.8),
            f'PalmCanopy_{i}',
            color=(0.1, 0.5, 0.12),
            rot=unreal.Rotator(0, random.uniform(0, 360), 0))

    spawn_mesh(unreal.Vector(-200, 100, 72), '/Engine/BasicShapes/Cube',
        unreal.Vector(2.0, 1.5, 0.08), 'HutFloor', color=(0.45, 0.3, 0.12))
    spawn_mesh(unreal.Vector(-280, 100, 140), '/Engine/BasicShapes/Cylinder',
        unreal.Vector(0.1, 0.1, 1.4), 'HutPole_L', color=(0.4, 0.25, 0.1))
    spawn_mesh(unreal.Vector(-120, 100, 140), '/Engine/BasicShapes/Cylinder',
        unreal.Vector(0.1, 0.1, 1.4), 'HutPole_R', color=(0.4, 0.25, 0.1))
    spawn_mesh(unreal.Vector(-280, 25, 140), '/Engine/BasicShapes/Cylinder',
        unreal.Vector(0.1, 0.1, 1.4), 'HutPole_BL', color=(0.4, 0.25, 0.1))
    spawn_mesh(unreal.Vector(-120, 25, 140), '/Engine/BasicShapes/Cylinder',
        unreal.Vector(0.1, 0.1, 1.4), 'HutPole_BR', color=(0.4, 0.25, 0.1))
    spawn_mesh(unreal.Vector(-200, 62, 230), '/Engine/BasicShapes/Cone',
        unreal.Vector(2.5, 2.0, 1.2), 'HutRoof', color=(0.55, 0.4, 0.15))

    for i in range(5):
        rx = random.uniform(-600, 600)
        ry = random.uniform(-600, 600)
        rs = random.uniform(0.4, 1.2)
        spawn_mesh(unreal.Vector(rx, ry, 70 + rs * 10),
            '/Engine/BasicShapes/Sphere',
            unreal.Vector(rs, rs, rs * 0.5),
            f'Rock_{i}', mat_path='/Game/StarterContent/Materials/M_Rock_Slate')

    campfire = el.spawn_actor_from_class(unreal.PointLight, unreal.Vector(100, -100, 110))
    cfc = campfire.get_component_by_class(unreal.PointLightComponent)
    if cfc:
        cfc.set_editor_property('intensity', 4000)
        cfc.set_editor_property('light_color', unreal.Color(255, 170, 60, 255))
        cfc.set_editor_property('attenuation_radius', 500)
    campfire.set_actor_label('Campfire')
    spawn_mesh(unreal.Vector(100, -100, 78), '/Engine/BasicShapes/Cylinder',
        unreal.Vector(0.3, 0.3, 0.1), 'FirePit', color=(0.2, 0.15, 0.1))

    pp = el.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0,0,0))
    pp.set_actor_scale3d(unreal.Vector(500, 500, 500))
    pp.set_editor_property('unbound', True)
    pp.set_actor_label('PostProcess')

    el.set_level_viewport_camera_info(
        unreal.Vector(-2500, -2500, 2000),
        unreal.Rotator(-35, 45, 0)
    )

    unreal.log('Island scene complete: ocean, beach, 8 palm trees, hut, campfire')
except Exception as e:
    unreal.log_error(str(e))
`.trim(),
  },
};

export function findMatchingTemplate(prompt: string): SceneTemplate | null {
  const lowerPrompt = prompt.toLowerCase().trim();

  for (const template of Object.values(SCENE_TEMPLATES)) {
    for (const keyword of template.keywords) {
      if (lowerPrompt.includes(keyword)) {
        return template;
      }
    }
  }

  return null;
}

export function getTemplateForPrompt(prompt: string): SceneTemplate | null {
  const template = findMatchingTemplate(prompt);
  if (!template) return null;
  if (template.code.includes("TODO") || template.code.includes("use AI")) return null;
  return template;
}
