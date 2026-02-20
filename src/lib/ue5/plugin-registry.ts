export const UE5_SERVER_CONFIG = {
  httpUrl: "http://localhost:30010",
  websocketUrl: "ws://localhost:30020",
  webInterfaceUrl: "http://localhost:30000",
  objectPath: "/Script/PythonScriptPlugin.Default__PythonScriptLibrary",
  functionName: "ExecutePythonCommand",
} as const;

interface PluginDef {
  name: string;
  description: string;
  agentUsage: string;
  examples?: string[];
  capabilities?: string[];
}

export const UE5_PLUGIN_REGISTRY: Record<string, PluginDef> = {
  pythonEditorScript: {
    name: "Python Editor Script Plugin",
    description:
      "Core Python integration for Unreal Editor. Allows executing Python code inside UE5.",
    agentUsage:
      "ALL agents can request Python code execution through this plugin. Thomas writes the code, Morgan validates it.",
    examples: [
      "import unreal",
      "unreal.EditorLevelLibrary.spawn_actor_from_class()",
      "unreal.log('Hello from Grand Studio!')",
    ],
  },
  editorScriptingUtilities: {
    name: "Editor Scripting Utilities",
    description:
      "CRITICAL tool for Python to create files, delete assets, organize folders, manage the Content Browser.",
    agentUsage:
      "Thomas uses this to manage project files and assets programmatically.",
    examples: [
      "unreal.EditorAssetLibrary.list_assets('/Game/Maps/')",
      "unreal.EditorAssetLibrary.delete_asset('/Game/OldAsset')",
      "unreal.EditorAssetLibrary.rename_asset(old_path, new_path)",
    ],
  },
  pythonFoundationPackages: {
    name: "Python Foundation Packages",
    description:
      "Python libraries for communicating with Windows OS and external files.",
    agentUsage:
      "Thomas can use os, pathlib, json to interact with the file system outside UE5.",
  },
  pcg: {
    name: "Procedural Content Generation (PCG) Framework",
    description:
      "Generates massive amounts of content using rules. Instead of placing items one by one, write a rule and UE5 places millions of objects automatically.",
    agentUsage:
      "Thomas writes PCG rules via Python. Alex designs the rules. Elena ensures the generated world fits the narrative.",
    examples: [
      "Create a meadow with flowers and rocks using PCG rules",
      "Scatter trees across a forest following natural distribution patterns",
      "Generate a ruined city with procedural debris placement",
    ],
    capabilities: [
      "Rule-based object scattering",
      "Density maps for natural distribution",
      "Biome-aware placement",
      "Real-time regeneration",
    ],
  },
  landmassAndWater: {
    name: "Landmass + Water Plugin",
    description:
      "Creates realistic mountains, rivers, oceans, and islands with code.",
    agentUsage:
      "Thomas can write code that generates an island with snowy mountains in 10 seconds.",
    examples: [
      "Generate terrain with erosion simulation",
      "Create river systems that follow terrain",
      "Build ocean with wave simulation",
      "Sculpt mountains with snow caps based on altitude",
    ],
  },
  worldPartition: {
    name: "World Partition",
    description:
      "Manages infinitely large maps (like GTA-scale worlds). Streams chunks in/out based on player position.",
    agentUsage:
      "Alex designs the world partition grid. Thomas configures streaming distances and loading priorities.",
    capabilities: [
      "Level streaming by grid cells",
      "Data layers for different content types",
      "HLOD (Hierarchical Level of Detail) generation",
      "Infinite world support",
    ],
  },
  megascans: {
    name: "Megascans Plugin (Quixel Bridge)",
    description:
      "Access to massive library of photorealistic rocks, plants, materials, surfaces scanned from the real world.",
    agentUsage:
      "Thomas can import Megascans assets via code. Elena can request specific environmental assets for narrative scenes.",
    capabilities: [
      "Photorealistic rock formations",
      "Scanned vegetation and trees",
      "Real-world surface materials",
      "Tileable textures",
    ],
  },
  ultraDynamicSky: {
    name: "Ultra Dynamic Sky",
    description:
      "Advanced sky and weather system. AI can change weather, make storms, snow, adjust time of day — all with code.",
    agentUsage:
      "Thomas controls weather and time of day via Python. Elena can request weather changes for narrative mood.",
    examples: [
      "Set time to sunset for dramatic scene",
      "Trigger thunderstorm during boss fight",
      "Create fog for horror atmosphere",
      "Snow falling during winter chapter",
    ],
  },
  eqs: {
    name: "Environment Query System (EQS)",
    description:
      "The brain of in-game AI characters. Teaches NPCs where to take cover, how to flank the player, where to patrol.",
    agentUsage:
      "Thomas implements EQS queries. Alex designs AI behavior strategies. Elena defines character personalities that influence behavior.",
    capabilities: [
      "Cover finding for combat AI",
      "Patrol path generation",
      "Strategic flanking behavior",
      "Dynamic threat assessment",
    ],
  },
  stateTree: {
    name: "State Tree",
    description:
      "Modern behavior system for characters. Creates complex logic like: if shot then flee, if night then sleep, if player nearby then alert.",
    agentUsage:
      "Thomas builds State Trees via Python. Elena writes behavior narratives that Thomas converts to State Tree logic.",
    capabilities: [
      "Hierarchical state machines",
      "Condition-based transitions",
      "Parallel state evaluation",
      "Reusable behavior modules",
    ],
  },
  smartObjects: {
    name: "Smart Objects",
    description:
      "Creates interactive objects that NPCs automatically know how to use (sit on chair, open door, pick up item).",
    agentUsage:
      "Thomas creates Smart Object definitions. Elena defines which interactions fit each character.",
    examples: [
      "Chair that NPCs automatically sit on",
      "Workbench that NPCs use for crafting",
      "Door that NPCs open contextually",
      "Campfire that NPCs gather around",
    ],
  },
  massEntity: {
    name: "Mass Entity",
    description:
      "Handles thousands of entities for battle scenes without lag. Essential for large-scale combat with thousands of soldiers.",
    agentUsage:
      "Thomas uses Mass Entity for crowd and army simulation. Alex designs entity archetypes.",
    capabilities: [
      "10,000+ entities without performance drop",
      "LOD-based entity processing",
      "Spatial partitioning for efficiency",
      "Batch movement and animation",
    ],
  },
  modelingToolsEditorMode: {
    name: "Modeling Tools Editor Mode",
    description:
      "Allows creating and modifying 3D objects directly in the editor with code.",
    agentUsage:
      "Thomas can create basic 3D shapes and modify meshes programmatically.",
    capabilities: [
      "Create primitive shapes",
      "Boolean operations (cut, merge)",
      "Mesh editing (extrude, bevel)",
      "UV unwrapping",
    ],
  },
  geometryScript: {
    name: "Geometry Script",
    description:
      "Python-accessible tool for creating and modifying complex geometric shapes in real-time.",
    agentUsage:
      "Thomas generates procedural geometry. Alex defines geometric parameters for architectural elements.",
  },
  datasmith: {
    name: "Datasmith",
    description:
      "Imports 3D models from 3ds Max, architecture software, CAD files into Unreal.",
    agentUsage:
      "Thomas handles Datasmith imports when external 3D assets need to be brought into the project.",
    capabilities: [
      "Import from 3ds Max, Maya, Blender",
      "CAD file support",
      "Architecture model import",
      "Material preservation on import",
    ],
  },
  moviePipelineQueue: {
    name: "Movie Pipeline Queue",
    description:
      "Renders high-quality cinematic output (4K/8K video). Used for trailers, cutscenes, and marketing material.",
    agentUsage:
      "Thomas sets up render queues. Elena writes cinematic sequences. Alex designs camera work.",
    capabilities: [
      "4K/8K video rendering",
      "Anti-aliasing and motion blur",
      "Custom render passes",
      "Batch rendering multiple shots",
    ],
  },
  electronicNodes: {
    name: "Electronic Nodes",
    description:
      "Visual enhancement for Blueprint node connections. Makes node graphs cleaner and easier to read.",
    agentUsage:
      "Improves visual clarity of any Blueprints the team creates.",
  },
};

export function buildUE5CapabilitiesContext(): string {
  let ctx = "\n=== AVAILABLE UE5 CAPABILITIES ===\n";
  ctx += "The following UE5 plugins are ACTIVE and available for use:\n\n";

  for (const plugin of Object.values(UE5_PLUGIN_REGISTRY)) {
    ctx += `**${plugin.name}**\n`;
    ctx += `${plugin.description}\n`;
    ctx += `Agent Usage: ${plugin.agentUsage}\n`;
    if (plugin.examples) {
      ctx += `Examples: ${plugin.examples.join(", ")}\n`;
    }
    if (plugin.capabilities) {
      ctx += `Capabilities: ${plugin.capabilities.join(", ")}\n`;
    }
    ctx += "\n";
  }

  ctx += "=== UE5 SERVER CONNECTION ===\n";
  ctx += `HTTP API: ${UE5_SERVER_CONFIG.httpUrl} (Remote Control HTTP Server)\n`;
  ctx += `WebSocket: ${UE5_SERVER_CONFIG.websocketUrl} (Remote Control WebSocket)\n`;
  ctx += `Web Interface: ${UE5_SERVER_CONFIG.webInterfaceUrl}\n`;
  ctx += "\nCode Execution Endpoint:\n";
  ctx += `  PUT ${UE5_SERVER_CONFIG.httpUrl}/remote/object/call\n`;
  ctx += `  objectPath: ${UE5_SERVER_CONFIG.objectPath}\n`;
  ctx += `  functionName: ${UE5_SERVER_CONFIG.functionName}\n`;
  ctx += '  parameters: { PythonCommand: "<your python code>" }\n';
  ctx += '\nEvery code block must start with "import unreal" and use only UE5-compatible Python.\n';

  return ctx;
}
