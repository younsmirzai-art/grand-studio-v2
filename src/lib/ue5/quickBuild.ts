/**
 * Quick Build: pre-built VERIFIED UE5 code components for fast scene creation.
 * Uses same patterns as codeLibrary.ts — no AI call needed for simple prompts.
 */
import { UE5_CODE_LIBRARY } from "./codeLibrary";

// Re-use verified snippets; each must be self-contained and end with a call + unreal.log
const SKY_AND_ATMOSPHERE = UE5_CODE_LIBRARY.SKY_AND_ATMOSPHERE;
const GROUND_PLANE = UE5_CODE_LIBRARY.GROUND_PLANE;
const FOG = UE5_CODE_LIBRARY.FOG;
const SIMPLE_HOUSE = UE5_CODE_LIBRARY.SIMPLE_HOUSE;
const POST_PROCESS = UE5_CODE_LIBRARY.POST_PROCESS;

// Trees around origin (multiple)
const TREES_SCENE = `
import unreal

def spawn_tree(x, y, trunk_height=3, canopy_size=2):
    editor = unreal.EditorLevelLibrary
    trunk_z = trunk_height * 50
    trunk = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(x, y, trunk_z))
    trunk.get_component_by_class(unreal.StaticMeshComponent).set_static_mesh(
        unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Cylinder'))
    trunk.set_actor_scale3d(unreal.Vector(0.3, 0.3, trunk_height))
    trunk.set_actor_label('Tree_Trunk')
    canopy_z = trunk_height * 100 + canopy_size * 30
    canopy = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(x, y, canopy_z))
    canopy.get_component_by_class(unreal.StaticMeshComponent).set_static_mesh(
        unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Sphere'))
    canopy.set_actor_scale3d(unreal.Vector(canopy_size, canopy_size, canopy_size * 0.8))
    canopy.set_actor_label('Tree_Canopy')

editor = unreal.EditorLevelLibrary
positions = [(-800, -600), (-900, 200), (-600, 800), (100, 900), (800, 700), (900, -100), (700, -800), (-200, -900)]
for i, (x, y) in enumerate(positions):
    spawn_tree(x, y, 3, 2)
unreal.log('Trees created')
`;

// Interior + outdoor lights
const POINT_LIGHTS_SCENE = `
import unreal

editor = unreal.EditorLevelLibrary

def add_light(loc, r, g, b, intensity=5000, label='Light'):
    light = editor.spawn_actor_from_class(unreal.PointLight, loc)
    light.get_component_by_class(unreal.PointLightComponent).set_editor_property('intensity', intensity)
    light.get_component_by_class(unreal.PointLightComponent).set_editor_property(
        'light_color', unreal.Color(r, g, b, 255))
    light.get_component_by_class(unreal.PointLightComponent).set_editor_property('attenuation_radius', 1000)
    light.set_actor_label(label)

add_light(unreal.Vector(0, 0, 200), 255, 200, 150, 8000, 'Light_Interior')
add_light(unreal.Vector(0, -500, 200), 200, 230, 255, 3000, 'Light_Front')
add_light(unreal.Vector(0, 500, 200), 180, 200, 255, 2000, 'Light_Back')
unreal.log('Lighting complete')
`;

export const QUICK_BUILD_COMPONENTS = {
  sky_and_atmosphere: SKY_AND_ATMOSPHERE,
  ground_plane: GROUND_PLANE,
  fog: FOG,
  simple_house: SIMPLE_HOUSE,
  trees: TREES_SCENE,
  point_lights: POINT_LIGHTS_SCENE,
  post_process: POST_PROCESS,
};

export const QUICK_BUILD_TASK_TITLES: Record<string, string> = {
  sky_and_atmosphere: "Sky & atmosphere",
  ground_plane: "Ground plane",
  fog: "Fog",
  simple_house: "House structure",
  trees: "Trees & vegetation",
  point_lights: "Lighting",
  post_process: "Post-processing",
};

export function detectSimplePrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const keywords = [
    "house", "castle", "tower", "forest", "island", "village",
    "mountain", "lake", "city", "dungeon", "cave", "temple",
    "build me", "create a", "make a", "simple", "medieval", "scene",
  ];
  return keywords.some((kw) => lower.includes(kw));
}

/** Returns ordered list of code strings and their task keys for quick build. */
export function getQuickBuildPlan(prompt: string): { key: string; code: string; title: string }[] {
  const lower = prompt.toLowerCase();
  const steps: { key: string; code: string; title: string }[] = [
    { key: "sky_and_atmosphere", code: QUICK_BUILD_COMPONENTS.sky_and_atmosphere, title: QUICK_BUILD_TASK_TITLES.sky_and_atmosphere },
    { key: "ground_plane", code: QUICK_BUILD_COMPONENTS.ground_plane, title: QUICK_BUILD_TASK_TITLES.ground_plane },
    { key: "fog", code: QUICK_BUILD_COMPONENTS.fog, title: QUICK_BUILD_TASK_TITLES.fog },
  ];

  if (lower.includes("house") || lower.includes("building") || lower.includes("castle") || lower.includes("structure")) {
    steps.push({ key: "simple_house", code: QUICK_BUILD_COMPONENTS.simple_house + "\nbuild_simple_house()", title: QUICK_BUILD_TASK_TITLES.simple_house });
  }
  if (lower.includes("tree") || lower.includes("forest") || lower.includes("nature") || lower.includes("vegetation") || lower.includes("castle")) {
    steps.push({ key: "trees", code: QUICK_BUILD_COMPONENTS.trees, title: QUICK_BUILD_TASK_TITLES.trees });
  }

  steps.push(
    { key: "point_lights", code: QUICK_BUILD_COMPONENTS.point_lights, title: QUICK_BUILD_TASK_TITLES.point_lights },
    { key: "post_process", code: QUICK_BUILD_COMPONENTS.post_process, title: QUICK_BUILD_TASK_TITLES.post_process },
  );

  return steps;
}
