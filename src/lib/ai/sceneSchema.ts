export interface SceneRequest {
  scene_type:
    | "village"
    | "city"
    | "forest"
    | "beach"
    | "desert"
    | "mountain"
    | "park"
    | "military"
    | "medieval"
    | "modern"
    | "custom";
  terrain:
    | "flat_grass"
    | "hills"
    | "mountain"
    | "island"
    | "desert_sand"
    | "snow"
    | "beach_sand"
    | "forest_floor"
    | "urban_flat"
    | "none";
  buildings: SceneObject[];
  vegetation: SceneObject[];
  vehicles: SceneObject[];
  infrastructure: SceneObject[];
  details: SceneObject[];
  characters: SceneObject[];
  layout: "grid" | "circle" | "random" | "along_road" | "clustered" | "scattered";
  lighting: "daytime" | "sunset" | "night" | "overcast" | "dawn";
  scale: "small" | "medium" | "large";
}

export interface SceneObject {
  /** e.g. "house", "tree", "car", "street_light" */
  type: string;
  /** How many instances to place (must be >= 1 when present) */
  count: number;
  style?: string;
  size?: "small" | "medium" | "large";
}

export type SceneObjectCategory =
  | "buildings"
  | "vegetation"
  | "vehicles"
  | "infrastructure"
  | "details"
  | "characters";

/** UE5 asset source for scene build engine */
export type AssetSourceMode = "my_assets" | "library" | "both";
