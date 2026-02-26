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
    code: "# Castle template - use AI build for now\nimport unreal\nunreal.log('Use AI to build castle')",
  },

  city_block: {
    name: "City Block",
    description: "Modern city block with buildings, roads, and street lights",
    keywords: ["city", "urban", "building", "skyscraper", "downtown", "street"],
    code: "# City template - use AI build for now\nimport unreal\nunreal.log('Use AI to build city')",
  },

  forest: {
    name: "Forest",
    description: "Dense forest with various trees, rocks, and a clearing",
    keywords: ["forest", "woods", "jungle", "nature", "wilderness"],
    code: "# Forest template - use AI build for now\nimport unreal\nunreal.log('Use AI to build forest')",
  },

  island: {
    name: "Island",
    description: "Tropical island with beach, palm trees, and ocean",
    keywords: ["island", "beach", "ocean", "tropical", "sea"],
    code: "# Island template - use AI build for now\nimport unreal\nunreal.log('Use AI to build island')",
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
