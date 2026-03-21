/** Rough environment from user prompt — drives which library assets to search for. */
export function detectEnvironment(prompt: string): "urban" | "village" | "forest" | "beach" | "desert" | "generic" {
  const p = prompt.toLowerCase();
  if (/new york|urban|city|downtown|skyscraper|manhattan|metropolitan|street|highway|nyc|los angeles|chicago/i.test(p))
    return "urban";
  if (/beach|coast|island|tropical|palm|ocean|shore|seaside/i.test(p)) return "beach";
  if (/desert|sand dune|arid|cactus|oasis/i.test(p)) return "desert";
  if (/forest village|woodland|village in forest/i.test(p)) return "forest";
  if (/forest|woods|mountain|hiking trail|pine/i.test(p)) return "forest";
  if (/village|rural|farm|farmhouse|countryside|medieval town|hamlet/i.test(p)) return "village";
  return "generic";
}

export function pickQueriesForAction(
  action: string,
  userPrompt: string,
  slotIndex: number
): { poly: string; sketchfab: string } {
  const env = detectEnvironment(userPrompt);
  const i = slotIndex % 20;
  const urbanBuildings = ["skyscraper", "office building", "apartment building", "city building", "modern building", "tower block", "brick building", "glass facade building", "residential block", "commercial building"];
  const villageBuildings = ["cottage", "farm house", "small house", "wooden house", "medieval house", "rustic building", "barn", "stone house", "country house", "village hut"];
  const trees = ["oak tree", "pine tree", "birch tree", "willow tree", "maple tree", "dead tree", "bush", "shrub", "fern", "grass clump"];
  const walls = ["fence wooden", "stone wall", "brick wall", "gate", "picket fence", "barrier", "railing", "hedge"];
  const vehicles = ["car sedan", "van", "truck", "bus", "bicycle", "motorcycle"];
  const detailsUrban = ["street lamp", "bench park", "trash can", "traffic light", "mailbox", "hydrant", "news stand", "planter box"];
  const detailsRural = ["wooden bench", "rock formation", "barrel", "crate", "wagon", "well", "hay bale", "fence post"];
  const beach = ["palm tree", "beach chair", "boat small", "dock piece", "surfboard", "shell", "umbrella beach", "lifeguard tower", "driftwood", "coral rock"];
  const desert = ["cactus", "desert rock", "sand dune rock", "desert hut", "camel statue", "dead tree desert", "ruin stone", "tent", "campfire ring", "dry bush"];

  const a = action.toLowerCase();
  if (a === "place_buildings") {
    if (env === "urban") return { poly: urbanBuildings[i % urbanBuildings.length], sketchfab: "building modern" };
    if (env === "village" || env === "generic") return { poly: villageBuildings[i % villageBuildings.length], sketchfab: "house medieval" };
    if (env === "beach") return { poly: beach[i % beach.length], sketchfab: "beach house" };
    if (env === "desert") return { poly: desert[i % desert.length], sketchfab: "desert building" };
    return { poly: villageBuildings[i % villageBuildings.length], sketchfab: "cabin" };
  }
  if (a === "place_trees") {
    if (env === "beach") return { poly: beach.filter((x) => x.includes("palm"))[0] ?? "palm tree", sketchfab: "palm tree" };
    return { poly: trees[i % trees.length], sketchfab: "tree stylized" };
  }
  if (a === "place_walls") return { poly: walls[i % walls.length], sketchfab: "fence" };
  if (a === "place_vehicles") {
    if (env === "urban") return { poly: vehicles[i % vehicles.length], sketchfab: "car city" };
    return { poly: "cart wooden", sketchfab: "tractor" };
  }
  if (a === "add_details")
    return env === "urban"
      ? { poly: detailsUrban[i % detailsUrban.length], sketchfab: "street props" }
      : { poly: detailsRural[i % detailsRural.length], sketchfab: "nature props" };
  if (a === "add_lighting") return { poly: "street lamp", sketchfab: "lamp outdoor" };
  if (a === "load_landscape") {
    if (env === "urban") return { poly: "city ground", sketchfab: "asphalt" };
    if (env === "beach") return { poly: "sand terrain", sketchfab: "beach sand" };
    if (env === "desert") return { poly: "desert ground", sketchfab: "sand" };
    if (env === "forest") return { poly: "forest ground", sketchfab: "terrain grass" };
    return { poly: "grass terrain", sketchfab: "ground plane" };
  }
  return { poly: "rock", sketchfab: "prop" };
}
