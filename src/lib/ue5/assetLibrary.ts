export interface AssetEntry {
  name: string;
  path: string;
  category: string;
  subcategory: string;
  description: string;
}

export const ASSET_CATALOG: AssetEntry[] = [
  // ARCHITECTURE
  { name: "Wall 400x200", path: "/Game/StarterContent/Architecture/Wall_400x200", category: "Architecture", subcategory: "Walls", description: "Standard wall piece, 400cm wide, 200cm tall" },
  { name: "Wall 400x300", path: "/Game/StarterContent/Architecture/Wall_400x300", category: "Architecture", subcategory: "Walls", description: "Tall wall piece" },
  { name: "Wall 400x400", path: "/Game/StarterContent/Architecture/Wall_400x400", category: "Architecture", subcategory: "Walls", description: "Extra tall wall" },
  { name: "Wall with Door", path: "/Game/StarterContent/Architecture/Wall_Door_400x300", category: "Architecture", subcategory: "Walls", description: "Wall with door cutout" },
  { name: "Wall with Window", path: "/Game/StarterContent/Architecture/Wall_Window_400x300", category: "Architecture", subcategory: "Walls", description: "Wall with window cutout" },
  { name: "Floor 400x400", path: "/Game/StarterContent/Architecture/Floor_400x400", category: "Architecture", subcategory: "Floors", description: "Floor tile" },
  { name: "Pillar", path: "/Game/StarterContent/Architecture/Pillar_50x500", category: "Architecture", subcategory: "Pillars", description: "Structural pillar" },
  { name: "Stairs", path: "/Game/StarterContent/Architecture/SM_Stairs", category: "Architecture", subcategory: "Stairs", description: "Staircase" },

  // PROPS
  { name: "Chair", path: "/Game/StarterContent/Props/SM_Chair", category: "Props", subcategory: "Furniture", description: "Simple chair" },
  { name: "Couch", path: "/Game/StarterContent/Props/SM_Couch", category: "Props", subcategory: "Furniture", description: "Sofa/couch" },
  { name: "Round Table", path: "/Game/StarterContent/Props/SM_TableRound", category: "Props", subcategory: "Furniture", description: "Round table" },
  { name: "Door", path: "/Game/StarterContent/Props/SM_Door", category: "Props", subcategory: "Fixtures", description: "Door" },
  { name: "Ceiling Lamp", path: "/Game/StarterContent/Props/SM_Lamp_Ceiling", category: "Props", subcategory: "Lighting", description: "Ceiling light fixture" },
  { name: "Desk Lamp", path: "/Game/StarterContent/Props/SM_Lamp_Desk", category: "Props", subcategory: "Lighting", description: "Desk lamp" },
  { name: "Frame", path: "/Game/StarterContent/Props/SM_Frame", category: "Props", subcategory: "Decor", description: "Picture frame" },
  { name: "Shelf", path: "/Game/StarterContent/Props/SM_Shelf", category: "Props", subcategory: "Furniture", description: "Wall shelf" },
  { name: "Rock", path: "/Game/StarterContent/Props/SM_Rock", category: "Props", subcategory: "Nature", description: "Natural rock" },
  { name: "Bush", path: "/Game/StarterContent/Props/SM_Bush", category: "Props", subcategory: "Nature", description: "Bush/shrub" },

  // MATERIALS
  { name: "Brick (Beveled)", path: "/Game/StarterContent/Materials/M_Brick_Clay_Beveled", category: "Materials", subcategory: "Stone", description: "Clay brick, beveled edges" },
  { name: "Brick (Old)", path: "/Game/StarterContent/Materials/M_Brick_Clay_Old", category: "Materials", subcategory: "Stone", description: "Weathered old brick" },
  { name: "Concrete", path: "/Game/StarterContent/Materials/M_Concrete_Poured", category: "Materials", subcategory: "Stone", description: "Poured concrete" },
  { name: "Metal (Steel)", path: "/Game/StarterContent/Materials/M_Metal_Burnished_Steel", category: "Materials", subcategory: "Metal", description: "Burnished steel" },
  { name: "Metal (Chrome)", path: "/Game/StarterContent/Materials/M_Metal_Chrome", category: "Materials", subcategory: "Metal", description: "Chrome finish" },
  { name: "Metal (Gold)", path: "/Game/StarterContent/Materials/M_Metal_Gold", category: "Materials", subcategory: "Metal", description: "Gold finish" },
  { name: "Wood Floor", path: "/Game/StarterContent/Materials/M_Wood_Floor_Walnut_Polished", category: "Materials", subcategory: "Wood", description: "Polished walnut floor" },
  { name: "Wood Oak", path: "/Game/StarterContent/Materials/M_Wood_Oak", category: "Materials", subcategory: "Wood", description: "Oak wood" },
  { name: "Glass", path: "/Game/StarterContent/Materials/M_Glass", category: "Materials", subcategory: "Glass", description: "Clear glass" },
  { name: "Grass", path: "/Game/StarterContent/Materials/M_Ground_Grass", category: "Materials", subcategory: "Ground", description: "Grass ground" },
  { name: "Gravel", path: "/Game/StarterContent/Materials/M_Ground_Gravel", category: "Materials", subcategory: "Ground", description: "Gravel path" },
  { name: "Water", path: "/Game/StarterContent/Materials/M_Water_Lake", category: "Materials", subcategory: "Water", description: "Lake water surface" },
  { name: "Rock Slate", path: "/Game/StarterContent/Materials/M_Rock_Slate", category: "Materials", subcategory: "Stone", description: "Slate rock" },
  { name: "Cobblestone", path: "/Game/StarterContent/Materials/M_CobbleStone_Smooth", category: "Materials", subcategory: "Stone", description: "Smooth cobblestone" },
  { name: "Tech Hex", path: "/Game/StarterContent/Materials/M_Tech_Hex_Tile", category: "Materials", subcategory: "Sci-Fi", description: "Hexagonal tech tile" },

  // BASIC SHAPES
  { name: "Cube", path: "/Engine/BasicShapes/Cube", category: "BasicShapes", subcategory: "Primitives", description: "100x100x100 cube" },
  { name: "Sphere", path: "/Engine/BasicShapes/Sphere", category: "BasicShapes", subcategory: "Primitives", description: "100-unit sphere" },
  { name: "Cylinder", path: "/Engine/BasicShapes/Cylinder", category: "BasicShapes", subcategory: "Primitives", description: "100-unit cylinder" },
  { name: "Cone", path: "/Engine/BasicShapes/Cone", category: "BasicShapes", subcategory: "Primitives", description: "100-unit cone" },
  { name: "Plane", path: "/Engine/BasicShapes/Plane", category: "BasicShapes", subcategory: "Primitives", description: "Flat plane" },

  // PARTICLES
  { name: "Fire", path: "/Game/StarterContent/Particles/P_Fire", category: "Particles", subcategory: "Effects", description: "Fire particle effect" },
  { name: "Smoke", path: "/Game/StarterContent/Particles/P_Smoke", category: "Particles", subcategory: "Effects", description: "Smoke particle effect" },
  { name: "Sparks", path: "/Game/StarterContent/Particles/P_Sparks", category: "Particles", subcategory: "Effects", description: "Spark particle effect" },
  { name: "Steam", path: "/Game/StarterContent/Particles/P_Steam", category: "Particles", subcategory: "Effects", description: "Steam particle effect" },
];

export function getAssetForDescription(description: string): AssetEntry | null {
  const lower = description.toLowerCase();

  const keywords: [string[], string][] = [
    [["brick wall", "brick"], "/Game/StarterContent/Architecture/Wall_400x200"],
    [["wall with door", "door wall", "doorway"], "/Game/StarterContent/Architecture/Wall_Door_400x300"],
    [["wall with window", "window wall"], "/Game/StarterContent/Architecture/Wall_Window_400x300"],
    [["wall"], "/Game/StarterContent/Architecture/Wall_400x200"],
    [["floor", "tile"], "/Game/StarterContent/Architecture/Floor_400x400"],
    [["pillar", "column"], "/Game/StarterContent/Architecture/Pillar_50x500"],
    [["stair", "steps"], "/Game/StarterContent/Architecture/SM_Stairs"],
    [["chair", "seat"], "/Game/StarterContent/Props/SM_Chair"],
    [["couch", "sofa"], "/Game/StarterContent/Props/SM_Couch"],
    [["table"], "/Game/StarterContent/Props/SM_TableRound"],
    [["lamp", "ceiling light"], "/Game/StarterContent/Props/SM_Lamp_Ceiling"],
    [["desk lamp"], "/Game/StarterContent/Props/SM_Lamp_Desk"],
    [["shelf", "shelving"], "/Game/StarterContent/Props/SM_Shelf"],
    [["rock", "boulder", "stone"], "/Game/StarterContent/Props/SM_Rock"],
    [["bush", "shrub"], "/Game/StarterContent/Props/SM_Bush"],
    [["frame", "picture"], "/Game/StarterContent/Props/SM_Frame"],
    [["door"], "/Game/StarterContent/Props/SM_Door"],
  ];

  for (const [kws, path] of keywords) {
    if (kws.some(kw => lower.includes(kw))) {
      return ASSET_CATALOG.find(a => a.path === path) ?? null;
    }
  }

  return null;
}

export function getAssetCategories(): string[] {
  return [...new Set(ASSET_CATALOG.map(a => a.category))];
}

export function getAssetsByCategory(category: string): AssetEntry[] {
  return ASSET_CATALOG.filter(a => a.category === category);
}

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
