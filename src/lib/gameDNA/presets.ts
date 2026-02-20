/**
 * Game DNA — lighting/atmosphere presets inspired by famous games.
 * Used to generate UE5 Python that applies style (directional light, fog, post process).
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface LightingPreset {
  directionalIntensity: number;
  directionalPitch: number;
  directionalColor: RGB;
  fogDensity?: number;
  fogColor?: RGB;
  bloomIntensity?: number;
  exposure?: number;
  ambientOcclusion?: number;
}

export interface GamePreset {
  name: string;
  lighting: LightingPreset;
  atmosphere: string;
  description: string;
}

export const gamePresets: Record<string, GamePreset> = {
  elden_ring: {
    name: "Elden Ring / Dark Souls",
    lighting: {
      directionalIntensity: 5,
      directionalPitch: -30,
      directionalColor: { r: 0.9, g: 0.8, b: 0.7 },
      fogDensity: 0.03,
      fogColor: { r: 0.5, g: 0.5, b: 0.4 },
      bloomIntensity: 1.5,
      exposure: -0.5,
      ambientOcclusion: 2.0,
    },
    atmosphere: "dark_fantasy",
    description: "Dark, moody, golden hour lighting with heavy fog",
  },
  minecraft: {
    name: "Minecraft / Voxel",
    lighting: {
      directionalIntensity: 10,
      directionalPitch: -60,
      directionalColor: { r: 1.0, g: 1.0, b: 1.0 },
      fogDensity: 0.001,
      bloomIntensity: 0.3,
      exposure: 1.0,
    },
    atmosphere: "bright_colorful",
    description: "Bright, colorful, clean lighting",
  },
  gta: {
    name: "GTA / Modern Open World",
    lighting: {
      directionalIntensity: 8,
      directionalPitch: -50,
      directionalColor: { r: 1.0, g: 0.95, b: 0.9 },
      fogDensity: 0.005,
      bloomIntensity: 0.8,
      exposure: 0.5,
    },
    atmosphere: "modern_realistic",
    description: "Realistic modern lighting with slight haze",
  },
  horror: {
    name: "Resident Evil / Horror",
    lighting: {
      directionalIntensity: 1,
      directionalPitch: -15,
      directionalColor: { r: 0.4, g: 0.5, b: 0.7 },
      fogDensity: 0.08,
      fogColor: { r: 0.2, g: 0.2, b: 0.3 },
      bloomIntensity: 2.0,
      exposure: -2.0,
      ambientOcclusion: 3.0,
    },
    atmosphere: "dark_horror",
    description: "Very dark, blue tint, heavy fog, claustrophobic",
  },
  zelda: {
    name: "Zelda / Stylized Adventure",
    lighting: {
      directionalIntensity: 8,
      directionalPitch: -55,
      directionalColor: { r: 1.0, g: 0.95, b: 0.85 },
      fogDensity: 0.01,
      fogColor: { r: 0.7, g: 0.8, b: 1.0 },
      bloomIntensity: 1.2,
      exposure: 0.8,
    },
    atmosphere: "stylized_adventure",
    description: "Bright, warm, slightly stylized with soft fog",
  },
  cyberpunk: {
    name: "Cyberpunk 2077 / Neon",
    lighting: {
      directionalIntensity: 2,
      directionalPitch: -20,
      directionalColor: { r: 0.5, g: 0.3, b: 0.8 },
      fogDensity: 0.04,
      fogColor: { r: 0.1, g: 0.05, b: 0.15 },
      bloomIntensity: 3.0,
      exposure: -1.0,
    },
    atmosphere: "neon_night",
    description: "Dark night, neon purple/pink lights, heavy bloom",
  },
  fortnite: {
    name: "Fortnite / Cartoon",
    lighting: {
      directionalIntensity: 10,
      directionalPitch: -65,
      directionalColor: { r: 1.0, g: 1.0, b: 1.0 },
      fogDensity: 0.002,
      bloomIntensity: 0.5,
      exposure: 1.5,
    },
    atmosphere: "bright_cartoon",
    description: "Very bright, colorful, cartoon-like",
  },
  skyrim: {
    name: "Skyrim / Nordic Fantasy",
    lighting: {
      directionalIntensity: 4,
      directionalPitch: -25,
      directionalColor: { r: 0.8, g: 0.85, b: 1.0 },
      fogDensity: 0.02,
      fogColor: { r: 0.6, g: 0.65, b: 0.7 },
      bloomIntensity: 1.0,
      exposure: -0.3,
    },
    atmosphere: "cold_nordic",
    description: "Cold, blue tint, misty mountains feel",
  },
};

/** Map of phrases/game names (lowercase) to preset key */
const PROMPT_TO_PRESET: Record<string, string> = {
  "elden ring": "elden_ring",
  "dark souls": "elden_ring",
  "minecraft": "minecraft",
  "voxel": "minecraft",
  "gta": "gta",
  "grand theft auto": "gta",
  "open world": "gta",
  "resident evil": "horror",
  "horror": "horror",
  "zelda": "zelda",
  "breath of the wild": "zelda",
  "stylized adventure": "zelda",
  "cyberpunk": "cyberpunk",
  "cyberpunk 2077": "cyberpunk",
  "neon": "cyberpunk",
  "fortnite": "fortnite",
  "cartoon": "fortnite",
  "skyrim": "skyrim",
  "nordic": "skyrim",
  "like elden ring": "elden_ring",
  "like minecraft": "minecraft",
  "like gta": "gta",
  "like zelda": "zelda",
  "like cyberpunk": "cyberpunk",
  "like fortnite": "fortnite",
  "like skyrim": "skyrim",
  "like dark souls": "elden_ring",
  "like resident evil": "horror",
};

/**
 * Detect a game style mention in the user's prompt. Returns preset key or null.
 */
export function detectGamePresetInPrompt(message: string): string | null {
  const lower = message.toLowerCase().trim();
  for (const [phrase, key] of Object.entries(PROMPT_TO_PRESET)) {
    if (lower.includes(phrase)) return key;
  }
  return null;
}

/**
 * Generate UE5 Python code to apply the given preset (directional light, fog, post process).
 */
export function generatePresetCode(preset: GamePreset): string {
  const L = preset.lighting;
  const fogDensity = L.fogDensity ?? 0.01;
  const fogColor = L.fogColor ?? { r: 0.5, g: 0.5, b: 0.5 };
  const bloomIntensity = L.bloomIntensity ?? 1.0;
  const exposure = L.exposure ?? 0;

  return `
import unreal

def apply_game_style():
    editor = unreal.EditorLevelLibrary()
    all_actors = editor.get_all_level_actors()
    
    dir_light = None
    for actor in all_actors:
        if isinstance(actor, unreal.DirectionalLight):
            dir_light = actor
            break
    
    if not dir_light:
        dir_light = editor.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 0))
    
    dir_light.set_actor_rotation(unreal.Rotator(${L.directionalPitch}, 0, 0))
    light_comp = dir_light.get_light_component()
    if light_comp:
        light_comp.set_intensity(${L.directionalIntensity})
        light_comp.set_light_color(unreal.LinearColor(${L.directionalColor.r}, ${L.directionalColor.g}, ${L.directionalColor.b}))
    
    fog = None
    for actor in all_actors:
        if isinstance(actor, unreal.ExponentialHeightFog):
            fog = actor
            break
    
    if not fog:
        fog = editor.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0, 0, 0))
    
    fog_comp = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
    if fog_comp:
        fog_comp.set_fog_density(${fogDensity})
        fog_comp.set_fog_inscattering_color(unreal.LinearColor(${fogColor.r}, ${fogColor.g}, ${fogColor.b}))
    
    pp = None
    for actor in all_actors:
        if isinstance(actor, unreal.PostProcessVolume):
            pp = actor
            break
    
    if not pp:
        pp = editor.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 0))
        pp.set_actor_scale3d(unreal.Vector(100, 100, 100))
        pp.unbound = True
    
    pp.settings.bloom_intensity = ${bloomIntensity}
    pp.settings.auto_exposure_bias = ${exposure}

apply_game_style()
`.trim();
}
