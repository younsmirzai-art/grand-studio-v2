/**
 * Official game templates for the Marketplace.
 * Seeded into game_templates via POST /api/templates/seed
 */

export interface OfficialTemplateInput {
  name: string;
  description: string;
  category: string;
  tags: string[];
  is_free: boolean;
  is_official: boolean;
  is_featured?: boolean;
  difficulty: string;
  estimated_build_time: number;
  game_dna_preset: string;
  agents_used: string[];
  ue5_code: string;
  template_data: {
    actors_count: number;
    lights_count: number;
    area_size: string;
    plugins_used: string[];
    theme: string;
  };
}

export const officialTemplates: OfficialTemplateInput[] = [
  {
    name: "Medieval Castle Kingdom",
    description:
      "A complete medieval kingdom with castle, village, forests, and farmland. Dark fantasy atmosphere with golden hour lighting. Includes 4 tower castle, village with 10 houses, river, bridge, and 50+ trees.",
    category: "medieval",
    tags: ["medieval", "castle", "fantasy", "kingdom", "rpg"],
    is_free: true,
    is_official: true,
    is_featured: true,
    difficulty: "beginner",
    estimated_build_time: 8,
    game_dna_preset: "elden_ring",
    agents_used: ["nima", "alex", "thomas", "elena"],
    ue5_code: `
import unreal

def build_medieval_kingdom():
    editor = unreal.EditorLevelLibrary()
    
    # Sky and atmosphere
    editor.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0))
    sun = editor.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 0))
    sun.set_actor_rotation(unreal.Rotator(-35, 45, 0))
    sun.get_light_component().set_intensity(8.0)
    sun.get_light_component().set_light_color(unreal.LinearColor(1.0, 0.9, 0.7))
    editor.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 0))
    editor.spawn_actor_from_class(unreal.VolumetricCloud, unreal.Vector(0, 0, 2000))
    
    fog = editor.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0, 0, 0))
    fog_comp = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
    fog_comp.set_fog_density(0.015)
    
    # Ground
    ground = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, 0))
    ground_mesh = ground.get_static_mesh_component()
    ground_mesh.set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Plane'))
    ground.set_actor_scale3d(unreal.Vector(500, 500, 1))
    
    # Castle - Main Keep
    keep = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, 0))
    keep.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cube'))
    keep.set_actor_scale3d(unreal.Vector(8, 8, 12))
    keep.set_actor_location(unreal.Vector(0, 0, 600))
    
    # Castle - 4 Towers
    tower_positions = [
        unreal.Vector(800, 800, 0),
        unreal.Vector(-800, 800, 0),
        unreal.Vector(800, -800, 0),
        unreal.Vector(-800, -800, 0)
    ]
    for pos in tower_positions:
        tower = editor.spawn_actor_from_class(unreal.StaticMeshActor, pos)
        tower.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cylinder'))
        tower.set_actor_scale3d(unreal.Vector(3, 3, 15))
        tower.set_actor_location(unreal.Vector(pos.x, pos.y, 750))
        
        cone = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(pos.x, pos.y, 1600))
        cone.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cone'))
        cone.set_actor_scale3d(unreal.Vector(4, 4, 3))
    
    wall_configs = [
        (unreal.Vector(0, 800, 400), unreal.Vector(16, 0.5, 8), unreal.Rotator(0, 0, 0)),
        (unreal.Vector(0, -800, 400), unreal.Vector(16, 0.5, 8), unreal.Rotator(0, 0, 0)),
        (unreal.Vector(800, 0, 400), unreal.Vector(0.5, 16, 8), unreal.Rotator(0, 0, 0)),
        (unreal.Vector(-800, 0, 400), unreal.Vector(0.5, 16, 8), unreal.Rotator(0, 0, 0)),
    ]
    for pos, scale, rot in wall_configs:
        wall = editor.spawn_actor_from_class(unreal.StaticMeshActor, pos)
        wall.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cube'))
        wall.set_actor_scale3d(scale)
        wall.set_actor_rotation(rot)
    
    import random
    random.seed(42)
    for i in range(10):
        hx = random.uniform(-3000, -1500)
        hy = random.uniform(-2000, 2000)
        house = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(hx, hy, 100))
        house.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cube'))
        house.set_actor_scale3d(unreal.Vector(2, 1.5, 2))
        roof = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(hx, hy, 300))
        roof.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cone'))
        roof.set_actor_scale3d(unreal.Vector(2.5, 2, 1.5))
    
    for i in range(50):
        tx = random.uniform(-5000, 5000)
        ty = random.uniform(-5000, 5000)
        if abs(tx) < 1200 and abs(ty) < 1200:
            continue
        trunk = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(tx, ty, 150))
        trunk.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cylinder'))
        trunk.set_actor_scale3d(unreal.Vector(0.3, 0.3, 3))
        canopy = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(tx, ty, 400))
        canopy.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Sphere'))
        canopy.set_actor_scale3d(unreal.Vector(2.5, 2.5, 2))
    
    river = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(-2000, 0, 5))
    river.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Plane'))
    river.set_actor_scale3d(unreal.Vector(10, 200, 1))
    
    torch_positions = [
        unreal.Vector(900, 0, 300), unreal.Vector(-900, 0, 300),
        unreal.Vector(0, 900, 300), unreal.Vector(0, -900, 300),
        unreal.Vector(500, 500, 200), unreal.Vector(-500, -500, 200),
    ]
    for pos in torch_positions:
        torch = editor.spawn_actor_from_class(unreal.PointLight, pos)
        torch.get_light_component().set_intensity(5000)
        torch.get_light_component().set_light_color(unreal.LinearColor(1.0, 0.5, 0.1))
        torch.get_light_component().set_attenuation_radius(800)
    
    pp = editor.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 0))
    pp.set_actor_scale3d(unreal.Vector(200, 200, 200))
    pp.settings.bloom_intensity = 1.5
    pp.settings.auto_exposure_bias = -0.3
    
    unreal.log('Medieval Castle Kingdom built successfully!')

build_medieval_kingdom()
`,
    template_data: {
      actors_count: 85,
      lights_count: 7,
      area_size: "10000x10000",
      plugins_used: ["BasicShapes"],
      theme: "dark_fantasy",
    },
  },
  {
    name: "Sci-Fi Space Station",
    description:
      "A futuristic space station interior with neon lighting, control rooms, corridors, and a viewing deck looking out to space. Cyberpunk atmosphere with purple and cyan neon lights.",
    category: "scifi",
    tags: ["scifi", "space", "cyberpunk", "neon", "futuristic"],
    is_free: true,
    is_official: true,
    is_featured: true,
    difficulty: "intermediate",
    estimated_build_time: 10,
    game_dna_preset: "cyberpunk",
    agents_used: ["nima", "alex", "thomas"],
    ue5_code: `
import unreal

def build_space_station():
    editor = unreal.EditorLevelLibrary()
    dim_light = editor.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 0))
    dim_light.set_actor_rotation(unreal.Rotator(-30, 0, 0))
    dim_light.get_light_component().set_intensity(0.5)
    dim_light.get_light_component().set_light_color(unreal.LinearColor(0.3, 0.3, 0.5))
    
    floor = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, 0))
    floor.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cube'))
    floor.set_actor_scale3d(unreal.Vector(50, 5, 0.2))
    
    ceiling = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, 400))
    ceiling.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cube'))
    ceiling.set_actor_scale3d(unreal.Vector(50, 5, 0.2))
    
    for side in [-250, 250]:
        wall = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, side, 200))
        wall.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cube'))
        wall.set_actor_scale3d(unreal.Vector(50, 0.2, 4))
    
    for i in range(-20, 21, 4):
        neon_cyan = editor.spawn_actor_from_class(unreal.RectLight, unreal.Vector(i * 100, -240, 350))
        neon_cyan.set_actor_rotation(unreal.Rotator(0, 90, 0))
        neon_cyan.get_light_component().set_intensity(50)
        neon_cyan.get_light_component().set_light_color(unreal.LinearColor(0, 1.0, 1.0))
        neon_purple = editor.spawn_actor_from_class(unreal.RectLight, unreal.Vector(i * 100, 240, 350))
        neon_purple.set_actor_rotation(unreal.Rotator(0, -90, 0))
        neon_purple.get_light_component().set_intensity(50)
        neon_purple.get_light_component().set_light_color(unreal.LinearColor(0.5, 0, 1.0))
    
    room_pos = unreal.Vector(2500, 0, 200)
    room = editor.spawn_actor_from_class(unreal.StaticMeshActor, room_pos)
    room.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cube'))
    room.set_actor_scale3d(unreal.Vector(8, 8, 4))
    
    for i in range(5):
        screen = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(2200 + i * 100, -350, 200))
        screen.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cube'))
        screen.set_actor_scale3d(unreal.Vector(0.8, 0.05, 0.6))
        screen_light = editor.spawn_actor_from_class(unreal.PointLight, unreal.Vector(2200 + i * 100, -300, 200))
        screen_light.get_light_component().set_intensity(100)
        screen_light.get_light_component().set_light_color(unreal.LinearColor(0, 0.8, 1.0))
        screen_light.get_light_component().set_attenuation_radius(200)
    
    pp = editor.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 0))
    pp.set_actor_scale3d(unreal.Vector(200, 200, 200))
    pp.settings.bloom_intensity = 3.0
    pp.settings.auto_exposure_bias = -1.5
    
    unreal.log('Sci-Fi Space Station built!')

build_space_station()
`,
    template_data: {
      actors_count: 60,
      lights_count: 25,
      area_size: "5000x500",
      plugins_used: ["BasicShapes"],
      theme: "cyberpunk",
    },
  },
  {
    name: "Horror Haunted Mansion",
    description:
      "A terrifying haunted mansion at night. Dark rooms, flickering lights, long corridors, and eerie atmosphere. Heavy fog, almost no ambient light, with occasional red and green accent lights.",
    category: "horror",
    tags: ["horror", "mansion", "haunted", "scary", "dark"],
    is_free: true,
    is_official: true,
    difficulty: "intermediate",
    estimated_build_time: 8,
    game_dna_preset: "horror",
    agents_used: ["nima", "thomas", "elena"],
    ue5_code: `
import unreal

def build_haunted_mansion():
    editor = unreal.EditorLevelLibrary()
    editor.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0))
    moon = editor.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 0))
    moon.set_actor_rotation(unreal.Rotator(-15, 30, 0))
    moon.get_light_component().set_intensity(0.3)
    moon.get_light_component().set_light_color(unreal.LinearColor(0.4, 0.5, 0.7))
    
    fog = editor.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0, 0, 0))
    fog_comp = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
    fog_comp.set_fog_density(0.08)
    
    ground = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, 0))
    ground.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Plane'))
    ground.set_actor_scale3d(unreal.Vector(100, 100, 1))
    
    mansion = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, 400))
    mansion.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cube'))
    mansion.set_actor_scale3d(unreal.Vector(12, 8, 8))
    
    roof = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, 900))
    roof.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cone'))
    roof.set_actor_scale3d(unreal.Vector(14, 10, 4))
    
    for side in [-800, 800]:
        wing = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, side, 250))
        wing.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cube'))
        wing.set_actor_scale3d(unreal.Vector(6, 4, 5))
    
    window_configs = [
        (unreal.Vector(610, -200, 500), unreal.LinearColor(0.8, 0.1, 0.1)),
        (unreal.Vector(610, 200, 500), unreal.LinearColor(0.1, 0.8, 0.1)),
        (unreal.Vector(610, 0, 700), unreal.LinearColor(0.8, 0.1, 0.1)),
        (unreal.Vector(-610, -300, 400), unreal.LinearColor(0.1, 0.8, 0.1)),
        (unreal.Vector(-610, 300, 400), unreal.LinearColor(0.8, 0.8, 0.1)),
    ]
    for pos, color in window_configs:
        light = editor.spawn_actor_from_class(unreal.PointLight, pos)
        light.get_light_component().set_intensity(500)
        light.get_light_component().set_light_color(color)
        light.get_light_component().set_attenuation_radius(400)
    
    import random
    random.seed(13)
    for i in range(15):
        tx = random.uniform(-3000, 3000)
        ty = random.uniform(-3000, 3000)
        if abs(tx) < 1000 and abs(ty) < 1000:
            continue
        trunk = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(tx, ty, 200))
        trunk.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cylinder'))
        trunk.set_actor_scale3d(unreal.Vector(0.2, 0.2, 4))
    
    for i in range(8):
        grave = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(1500 + i * 150, -500, 75))
        grave.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cube'))
        grave.set_actor_scale3d(unreal.Vector(0.5, 0.2, 1.5))
    
    pp = editor.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 0))
    pp.set_actor_scale3d(unreal.Vector(200, 200, 200))
    pp.settings.bloom_intensity = 2.0
    pp.settings.auto_exposure_bias = -2.5
    pp.settings.ambient_occlusion_intensity = 3.0
    
    unreal.log('Haunted Mansion built!')

build_haunted_mansion()
`,
    template_data: {
      actors_count: 45,
      lights_count: 7,
      area_size: "6000x6000",
      plugins_used: ["BasicShapes"],
      theme: "horror",
    },
  },
  {
    name: "Tropical Paradise Island",
    description:
      "Beautiful tropical island with palm trees, sandy beach, crystal clear water, and bright sunny sky. Perfect for adventure or survival games.",
    category: "nature",
    tags: ["tropical", "island", "beach", "palm", "ocean", "adventure"],
    is_free: true,
    is_official: true,
    difficulty: "beginner",
    estimated_build_time: 6,
    game_dna_preset: "fortnite",
    agents_used: ["thomas"],
    ue5_code: `
import unreal
import random

def build_tropical_island():
    editor = unreal.EditorLevelLibrary()
    random.seed(7)
    editor.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0))
    sun = editor.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 0))
    sun.set_actor_rotation(unreal.Rotator(-65, 30, 0))
    sun.get_light_component().set_intensity(12)
    sun.get_light_component().set_light_color(unreal.LinearColor(1.0, 1.0, 0.95))
    editor.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 0))
    editor.spawn_actor_from_class(unreal.VolumetricCloud, unreal.Vector(0, 0, 2000))
    
    ocean = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, -10))
    ocean.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Plane'))
    ocean.set_actor_scale3d(unreal.Vector(1000, 1000, 1))
    
    island = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, -200))
    island.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Sphere'))
    island.set_actor_scale3d(unreal.Vector(30, 25, 3))
    
    for i in range(30):
        px = random.uniform(-2000, 2000)
        py = random.uniform(-1500, 1500)
        trunk = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(px, py, 200))
        trunk.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cylinder'))
        trunk.set_actor_scale3d(unreal.Vector(0.15, 0.15, 4))
        canopy = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(px, py, 500))
        canopy.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Sphere'))
        canopy.set_actor_scale3d(unreal.Vector(2, 2, 1))
    
    hut = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(500, 0, 75))
    hut.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cube'))
    hut.set_actor_scale3d(unreal.Vector(2, 1.5, 1.5))
    hut_roof = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(500, 0, 225))
    hut_roof.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cone'))
    hut_roof.set_actor_scale3d(unreal.Vector(2.5, 2, 1))
    
    for i in range(10):
        rx = random.uniform(-1500, 1500)
        ry = random.uniform(-1200, 1200)
        rock = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(rx, ry, 30))
        rock.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Sphere'))
        rock.set_actor_scale3d(unreal.Vector(random.uniform(0.5, 1.5), random.uniform(0.5, 1.5), random.uniform(0.3, 0.8)))
    
    pp = editor.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 0))
    pp.set_actor_scale3d(unreal.Vector(200, 200, 200))
    pp.settings.bloom_intensity = 0.5
    pp.settings.auto_exposure_bias = 1.2
    
    unreal.log('Tropical Paradise Island built!')

build_tropical_island()
`,
    template_data: {
      actors_count: 75,
      lights_count: 2,
      area_size: "4000x3000",
      plugins_used: ["BasicShapes"],
      theme: "tropical",
    },
  },
  {
    name: "Modern City Block",
    description:
      "A modern city block with skyscrapers, streets, street lights, and urban atmosphere. Realistic daytime lighting suitable for GTA-style or urban games.",
    category: "modern",
    tags: ["city", "modern", "urban", "skyscraper", "gta", "streets"],
    is_free: true,
    is_official: true,
    difficulty: "intermediate",
    estimated_build_time: 10,
    game_dna_preset: "gta",
    agents_used: ["alex", "thomas"],
    ue5_code: `
import unreal
import random

def build_modern_city():
    editor = unreal.EditorLevelLibrary()
    random.seed(99)
    editor.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0))
    sun = editor.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 0))
    sun.set_actor_rotation(unreal.Rotator(-55, 40, 0))
    sun.get_light_component().set_intensity(10)
    editor.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 0))
    editor.spawn_actor_from_class(unreal.VolumetricCloud, unreal.Vector(0, 0, 2000))
    
    fog = editor.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0, 0, 0))
    fog.get_component_by_class(unreal.ExponentialHeightFogComponent).set_fog_density(0.005)
    
    street = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, 0))
    street.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Plane'))
    street.set_actor_scale3d(unreal.Vector(200, 200, 1))
    
    for row in range(-3, 4):
        for col in range(-3, 4):
            if abs(row) <= 1 and abs(col) <= 1:
                continue
            bx = row * 800
            by = col * 800
            height = random.uniform(5, 25)
            building = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(bx, by, height * 50))
            building.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cube'))
            building.set_actor_scale3d(unreal.Vector(3 + random.uniform(0, 2), 3 + random.uniform(0, 2), height))
    
    for i in range(-5, 6):
        for side in [-300, 300]:
            pole = editor.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(i * 400, side, 200))
            pole.get_static_mesh_component().set_static_mesh(unreal.load_object(None, '/Engine/BasicShapes/Cylinder'))
            pole.set_actor_scale3d(unreal.Vector(0.1, 0.1, 4))
            lamp = editor.spawn_actor_from_class(unreal.PointLight, unreal.Vector(i * 400, side, 450))
            lamp.get_light_component().set_intensity(2000)
            lamp.get_light_component().set_light_color(unreal.LinearColor(1.0, 0.95, 0.8))
            lamp.get_light_component().set_attenuation_radius(600)
    
    pp = editor.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 0))
    pp.set_actor_scale3d(unreal.Vector(200, 200, 200))
    pp.settings.bloom_intensity = 0.8
    pp.settings.auto_exposure_bias = 0.3
    
    unreal.log('Modern City Block built!')

build_modern_city()
`,
    template_data: {
      actors_count: 100,
      lights_count: 25,
      area_size: "6000x6000",
      plugins_used: ["BasicShapes"],
      theme: "modern",
    },
  },
];
