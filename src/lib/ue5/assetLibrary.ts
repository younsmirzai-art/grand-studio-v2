export const UE5_ASSET_LIBRARY = {
  materials: {
    brick: "/Game/StarterContent/Materials/M_Brick_Clay_Beveled",
    brick_old: "/Game/StarterContent/Materials/M_Brick_Clay_Old",
    concrete: "/Game/StarterContent/Materials/M_Concrete_Poured",
    metal: "/Game/StarterContent/Materials/M_Metal_Burnished_Steel",
    metal_chrome: "/Game/StarterContent/Materials/M_Metal_Chrome",
    metal_gold: "/Game/StarterContent/Materials/M_Metal_Gold",
    wood_floor: "/Game/StarterContent/Materials/M_Wood_Floor_Walnut_Polished",
    wood_oak: "/Game/StarterContent/Materials/M_Wood_Oak",
    glass: "/Game/StarterContent/Materials/M_Glass",
    ground_grass: "/Game/StarterContent/Materials/M_Ground_Grass",
    ground_gravel: "/Game/StarterContent/Materials/M_Ground_Gravel",
    water: "/Game/StarterContent/Materials/M_Water_Lake",
    rock: "/Game/StarterContent/Materials/M_Rock_Slate",
    ceramic: "/Game/StarterContent/Materials/M_CobbleStone_Smooth",
    tech_hex: "/Game/StarterContent/Materials/M_Tech_Hex_Tile",
    colored: "/Engine/BasicShapes/BasicShapeMaterial",
  },

  meshes: {
    cube: "/Engine/BasicShapes/Cube",
    sphere: "/Engine/BasicShapes/Sphere",
    cylinder: "/Engine/BasicShapes/Cylinder",
    cone: "/Engine/BasicShapes/Cone",
    plane: "/Engine/BasicShapes/Plane",

    wall_400x200: "/Game/StarterContent/Architecture/Wall_400x200",
    wall_400x300: "/Game/StarterContent/Architecture/Wall_400x300",
    wall_400x400: "/Game/StarterContent/Architecture/Wall_400x400",
    wall_door: "/Game/StarterContent/Architecture/Wall_Door_400x300",
    wall_window: "/Game/StarterContent/Architecture/Wall_Window_400x300",
    floor_400x400: "/Game/StarterContent/Architecture/Floor_400x400",
    pillar_50x500: "/Game/StarterContent/Architecture/Pillar_50x500",
    stairs: "/Game/StarterContent/Architecture/SM_Stairs",

    chair: "/Game/StarterContent/Props/SM_Chair",
    couch: "/Game/StarterContent/Props/SM_Couch",
    door: "/Game/StarterContent/Props/SM_Door",
    lamp_ceiling: "/Game/StarterContent/Props/SM_Lamp_Ceiling",
    lamp_desk: "/Game/StarterContent/Props/SM_Lamp_Desk",
    table_round: "/Game/StarterContent/Props/SM_TableRound",
    frame: "/Game/StarterContent/Props/SM_Frame",
    shelf: "/Game/StarterContent/Props/SM_Shelf",
    rock: "/Game/StarterContent/Props/SM_Rock",
    bush: "/Game/StarterContent/Props/SM_Bush",

    fire: "/Game/StarterContent/Particles/P_Fire",
    smoke: "/Game/StarterContent/Particles/P_Smoke",
    sparks: "/Game/StarterContent/Particles/P_Sparks",
    steam: "/Game/StarterContent/Particles/P_Steam",
  },

  sounds: {
    fire: "/Game/StarterContent/Audio/Fire01",
    ambient: "/Game/StarterContent/Audio/Ambient_Wind",
    explosion: "/Game/StarterContent/Audio/Explosion01",
    impact: "/Game/StarterContent/Audio/Impact01",
  },
} as const;

export function getAssetPromptText(): string {
  let text = "AVAILABLE UE5 ASSETS:\n\n";

  text += "--- MATERIALS (apply with set_material) ---\n";
  for (const [name, path] of Object.entries(UE5_ASSET_LIBRARY.materials)) {
    text += `  ${name}: '${path}'\n`;
  }

  text += "\n--- MESHES (use with load_asset + set_static_mesh) ---\n";
  for (const [name, path] of Object.entries(UE5_ASSET_LIBRARY.meshes)) {
    text += `  ${name}: '${path}'\n`;
  }

  text += "\n--- HOW TO USE STARTER CONTENT ASSETS ---\n";
  text +=
    "To use Starter Content assets, the UE5 project must have Starter Content enabled.\n";
  text +=
    "If a Starter Content asset fails to load, fall back to BasicShapes + dynamic materials.\n";
  text += "\nExample - Wall with brick material:\n";
  text +=
    "  wall = editor.spawn_actor_from_class(unreal.StaticMeshActor, pos)\n";
  text +=
    "  mesh = wall.get_component_by_class(unreal.StaticMeshComponent)\n";
  text += "  wall_mesh = unreal.EditorAssetLibrary.load_asset('/Game/StarterContent/Architecture/Wall_400x200')\n";
  text += "  if wall_mesh:\n";
  text += "    mesh.set_static_mesh(wall_mesh)\n";
  text += "  else:\n";
  text += "    mesh.set_static_mesh(unreal.EditorAssetLibrary.load_asset('/Engine/BasicShapes/Cube'))\n";
  text +=
    "  brick_mat = unreal.EditorAssetLibrary.load_asset('/Game/StarterContent/Materials/M_Brick_Clay_Beveled')\n";
  text += "  if brick_mat:\n";
  text += "    mesh.set_material(0, brick_mat)\n";

  return text;
}
