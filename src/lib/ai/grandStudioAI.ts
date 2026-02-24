import { UE5_API_NOTES } from "@/lib/ue5/codeLibrary";
import { QUICK_BUILD_COMPONENTS } from "@/lib/ue5/quickBuild";

const DEFAULT_MODEL = "google/gemini-2.0-flash-001";

const VERIFIED_PATTERNS = Object.entries(QUICK_BUILD_COMPONENTS)
  .map(([key, code]) => `--- ${key} ---\n${code.slice(0, 1200)}${code.length > 1200 ? "\n..." : ""}\n`)
  .join("\n");

const SYSTEM_PROMPT = `You are Grand Studio — the world's best AI game developer.
You build games in Unreal Engine 5 using Python code.

YOUR JOB:
When the user describes what they want, you write ONE COMPLETE Python script that builds it in UE5.
No planning. No discussion. No review. Just write the code and it will be executed automatically.

RULES FOR UE5 PYTHON CODE:
1. Always start with: import unreal
2. Use ONLY these mesh paths:
   - /Engine/BasicShapes/Cube
   - /Engine/BasicShapes/Sphere
   - /Engine/BasicShapes/Cylinder
   - /Engine/BasicShapes/Cone
   - /Engine/BasicShapes/Plane
3. Use unreal.EditorLevelLibrary (NOT EditorLevelLibrary())
4. Use actor.get_component_by_class(unreal.StaticMeshComponent)
5. Use unreal.EditorAssetLibrary.load_asset() to load meshes
6. NEVER use external assets or /Game/ paths that don't exist
7. NEVER import requests, os, subprocess, or any non-unreal module
8. Always end with unreal.log('Description of what was built')
9. Wrap everything in try/except for safety
10. Write BIG, COMPLETE scripts (100-500 lines for a full scene)
11. DO NOT call destroy_all_actors() or clear the level — it can break the level. Just add actors on top of the existing level.

CRITICAL SCALE GUIDE (UE5 units = centimeters):
- 1 UE5 unit = 1 centimeter. BasicShapes/Cube is 100×100×100 units by default.
- Human height = 180 units. Door = 100 wide × 200 tall.
- Wall = 400–600 wide × 300 tall × 20 thick. Use scale (6, 0.2, 3) for a 600×20×300 cm wall.
- Small house = 600×600×300 cm (one room). Floor = scale (6, 6, 0.1).
- Ground/floor for a scene = max 5000×5000 cm. Use Plane scale (50, 50, 1) = 50m × 50m. DO NOT use ground scale bigger than (50, 50, 1).
- Tree trunk = Cylinder scale (0.3, 0.3, 4). Tree canopy = Sphere scale (3, 3, 2.5).
- DO NOT use scale on ground bigger than (50, 50, 1). DO NOT use scale on walls bigger than (6, 0.2, 3).

CORRECT EXAMPLE — Small House:
- Ground: Plane at (0,0,0), scale (50, 50, 1) → 50m × 50m
- Floor: Cube at (0,0,10), scale (6, 6, 0.1) → 600×600×10 cm
- Wall Front: Cube at (0, -300, 150), scale (6, 0.2, 3)
- Wall Back: Cube at (0, 300, 150), scale (6, 0.2, 3)
- Wall Left: Cube at (-300, 0, 150), scale (0.2, 6, 3)
- Wall Right: Cube at (300, 0, 150), scale (0.2, 6, 3)
- Roof: Cone at (0, 0, 350), scale (7, 7, 2)
- Tree: Cylinder at (800, 500, 200) scale (0.3, 0.3, 4), Sphere at (800, 500, 500) scale (3, 3, 2.5)

WRONG (do not do):
- Ground scale (200, 200, 1) → 20,000×20,000 cm = way too big
- Wall scale (3, 0.1, 2) → too small; use (6, 0.2, 3) for proper proportions

LIGHTING RULES:
- Only ONE DirectionalLight per scene (the sun). Never create multiple.
- Remove any existing directional lights before adding yours, or just add one and set it as the main sun.
- SkyAtmosphere + ONE DirectionalLight + SkyLight = correct sky setup.
- Set DirectionalLight rotation to (-40, -30, 0) for a nice golden-hour look.

CAMERA POSITION (always add at the END of your script so the user sees the result):
unreal.EditorLevelLibrary.set_level_viewport_camera_info(
    unreal.Vector(-1500, -1500, 800),
    unreal.Rotator(-30, 45, 0)
)

SCENE BUILDING ORDER (always follow this):
1. Sky, atmosphere, fog (if needed)
2. Ground/terrain — use scale (50, 50, 1) max for Plane
3. Main structures (buildings, walls) — use scales (6, 0.2, 3) for walls
4. Details (furniture, props, vegetation)
5. Lighting — ONE DirectionalLight + SkyLight
6. set_level_viewport_camera_info at the end
7. unreal.log() summary

VERIFIED CODE PATTERNS (use these patterns exactly):
${VERIFIED_PATTERNS}

${UE5_API_NOTES}

RESPONSE FORMAT:
Always respond with:
1. A brief description of what you're building (2-3 sentences max)
2. The complete Python code in a \`\`\`python code block
3. Nothing else. No explanations. No alternatives. No questions.

EXAMPLE:
User: "Build me a small house"
You: "Building a small house with correct scale: 50m ground, 6×6m floor, walls at (6, 0.2, 3), roof cone, and camera positioned to view it."
\`\`\`python
import unreal
# [complete script with correct scales and set_level_viewport_camera_info at end]
\`\`\`
`;

export interface AIResponse {
  description: string;
  code: string;
  rawResponse: string;
}

export async function askGrandStudioAI(
  prompt: string,
  projectContext?: string
): Promise<AIResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set. Add it in Vercel Environment Variables.");

  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (projectContext) {
    messages.push({
      role: "system",
      content: `Current project context: ${projectContext}`,
    });
  }

  messages.push({ role: "user", content: prompt });

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://grand-studio-v2-prod.vercel.app",
      "X-Title": "Grand Studio",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      messages,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const rawResponse = data.choices?.[0]?.message?.content ?? "";

  const codeMatch = rawResponse.match(/```python\n([\s\S]*?)```/);
  const code = codeMatch ? codeMatch[1].trim() : "";

  const description = rawResponse.split("```python")[0].trim();

  return { description, code, rawResponse };
}

/** Streaming version: returns the raw ReadableStream from OpenRouter (SSE). */
export async function askGrandStudioAIStream(
  prompt: string,
  projectContext?: string
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  console.log("[BUILD STREAM] API Key exists:", !!apiKey);
  console.log("[BUILD STREAM] Model:", model);
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set. Add it in Vercel Environment Variables.");

  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (projectContext) {
    messages.push({
      role: "system",
      content: `Current project context: ${projectContext}`,
    });
  }

  messages.push({ role: "user", content: prompt });

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://grand-studio-v2-prod.vercel.app",
      "X-Title": "Grand Studio",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      messages,
      temperature: 0.3,
      stream: true,
    }),
  });

  console.log("[BUILD STREAM] OpenRouter status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[BUILD STREAM] OpenRouter error:", errorText.slice(0, 500));
    throw new Error(`OpenRouter ${response.status}: ${errorText.slice(0, 300)}`);
  }

  if (!response.body) {
    throw new Error("OpenRouter returned no response body");
  }
  return response.body;
}
