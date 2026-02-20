/**
 * Smart prompt expansion: turn a short user idea into a detailed technical plan
 * so Nima (and the rest of the pipeline) get a richer brief.
 */
import { createServerClient } from "@/lib/supabase/server";
import { getAgent } from "./identity";
import { buildSystemPrompt } from "./prompts";
import { buildUE5CapabilitiesContext } from "@/lib/ue5/plugin-registry";

const EXPAND_TIMEOUT_MS = 45_000;

async function getContextForExpand(projectId?: string): Promise<string> {
  if (!projectId) return "User is about to start a new game project. No project context yet.\n" + buildUE5CapabilitiesContext();
  const supabase = createServerClient();
  const { data: project } = await supabase.from("projects").select("name, initial_prompt").eq("id", projectId).single();
  const ctx = `Project: ${(project as { name?: string } | null)?.name ?? "Unknown"}\nBrief: ${(project as { initial_prompt?: string } | null)?.initial_prompt ?? ""}\n`;
  return ctx + buildUE5CapabilitiesContext();
}

/**
 * Expand a short user prompt into a detailed step-by-step build plan (text).
 * Used before Full Project to improve task quality.
 */
export async function expandPrompt(userPrompt: string, projectId?: string): Promise<string> {
  const nima = getAgent("Nima");
  if (!nima) return userPrompt;

  const context = await getContextForExpand(projectId);

  const systemPrompt = buildSystemPrompt(nima, context);
  const userMessage = `The user wants to build a game. Their request: "${userPrompt}"

Create a DETAILED step-by-step build plan in plain language. For each step mention:
1. What to build (specific UE5 elements: terrain, lights, actors, etc.)
2. Which agent type should do it (Thomas for code, Alex for systems, Elena for narrative, Morgan for review)
3. What the outcome should be

Rules:
- Always start with landscape/terrain first, then sky and lighting, then major structures, then details and props, then effects and atmosphere, then review and polish.
- Use ONLY basic shapes and built-in UE5 features. Do NOT reference external assets that might not exist.
- Every step must be achievable with WORKING Python code in UE5.
- Keep the plan concise but specific (one short paragraph or bullet list).
- End with a clear summary the task planner can use.

Do not output TASK| lines — just a detailed plan description.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXPAND_TIMEOUT_MS);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://grand-studio-v2.vercel.app",
        "X-Title": "Grand Studio v2",
      },
      body: JSON.stringify({
        model: nima.model,
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) return userPrompt;
    const data = await response.json();
    const expanded = (data.choices?.[0]?.message?.content as string)?.trim();
    return expanded && expanded.length > 20 ? expanded : userPrompt;
  } catch {
    clearTimeout(timeout);
    return userPrompt;
  }
}
