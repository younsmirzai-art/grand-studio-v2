import { UE5_API_NOTES } from "@/lib/ue5/codeLibrary";
import { QUICK_BUILD_COMPONENTS } from "@/lib/ue5/quickBuild";

const VERIFIED_PATTERNS = Object.entries(QUICK_BUILD_COMPONENTS)
  .map(([key, code]) => `--- ${key} ---\n${code.slice(0, 1200)}${code.length > 1200 ? "\n..." : ""}\n`)
  .join("\n");

const SYSTEM_PROMPT = `You are Grand Studio — the world's best AI game developer.
You build games in Unreal Engine 5 using Python code.

YOUR JOB:
When the user describes what they want, you write ONE COMPLETE Python script that builds it in UE5.
No planning. No discussion. No review. Just write the code and it will be executed.

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

SCENE BUILDING ORDER (always follow this):
1. First: Clear/prepare the level
2. Second: Sky, atmosphere, fog
3. Third: Ground/terrain
4. Fourth: Main structures (buildings, walls, etc.)
5. Fifth: Details (furniture, props, vegetation)
6. Sixth: Lighting (directional, point lights, ambient)
7. Seventh: Post-processing and atmosphere effects
8. Last: unreal.log() summary

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
You: "Building a medieval-style house with 4 walls, floor, peaked roof, door opening, and surrounding trees with cinematic lighting."
\`\`\`python
import unreal
# [complete 200+ line script that builds EVERYTHING]
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
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

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
      model: "anthropic/claude-sonnet-4-20250514",
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
): Promise<ReadableStream<Uint8Array> | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

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
      model: "anthropic/claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages,
      temperature: 0.3,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) return null;
  return response.body;
}
