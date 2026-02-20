/**
 * Smart error debugging with Morgan: analyze UE5 execution errors,
 * get a fix from Morgan, and retry execution.
 */

import { createServerClient } from "@/lib/supabase/server";
import { getAgent } from "./identity";
import { buildSystemPrompt } from "./prompts";

export interface ExecutionError {
  commandId?: string;
  code: string;
  error: string;
  agentName: string;
  projectId: string;
}

export interface DebugResult {
  analysis: string;
  fixedCode: string | null;
  confidence: "low" | "medium" | "high";
}

const MORGAN_DEBUG_TIMEOUT_MS = 45_000;

/**
 * Extract [FIX] ... ```python ... ``` block from Morgan's response.
 */
export function extractFixedCode(response: string): string | null {
  const fixSection = response.includes("[FIX]")
    ? response.slice(response.indexOf("[FIX]"))
    : response;
  const match = fixSection.match(/```python\s*\n?([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

/**
 * Call Morgan with the error and original code; return analysis and extracted fix.
 */
export async function autoDebugError(
  error: ExecutionError,
  projectContext: string
): Promise<DebugResult> {
  const morgan = getAgent("Morgan");
  if (!morgan) {
    return { analysis: "Morgan not available.", fixedCode: null, confidence: "low" };
  }

  const systemPrompt = buildSystemPrompt(morgan, projectContext);
  const userPrompt = `A UE5 Python execution failed. Analyze the error and provide a fix.

**Original code (from ${error.agentName}):**
\`\`\`python
${error.code}
\`\`\`

**Error:**
${error.error}

Reply with:
1. A short explanation of what went wrong.
2. Then write [FIX] and your corrected code in a \`\`\`python code block.
If you cannot fix it, say so and do not include [FIX].`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MORGAN_DEBUG_TIMEOUT_MS);
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
        model: morgan.model,
        max_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return { analysis: `Morgan request failed: ${response.status}`, fixedCode: null, confidence: "low" };
    }
    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content as string) ?? "";
    const fixedCode = extractFixedCode(content);
    const confidence = fixedCode ? (content.toLowerCase().includes("cannot fix") ? "low" : "medium") : "low";
    return { analysis: content, fixedCode, confidence };
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : String(e);
    return { analysis: `Morgan debug failed: ${msg}`, fixedCode: null, confidence: "low" };
  }
}

export type ExecuteInUE5 = (
  projectId: string,
  code: string,
  agentName: string
) => Promise<{ success: boolean; error?: string }>;

/**
 * Loop: ask Morgan for a fix → insert chat turn with analysis → execute fixed code.
 * On success: insert "Bug fixed", log debug_success, return true.
 * On failure: update error and retry up to maxRetries.
 * If no fix or max retries: insert failure message, return false.
 */
export async function debugAndRetry(
  error: ExecutionError,
  projectContext: string,
  executeInUE5: ExecuteInUE5,
  maxRetries: number = 3
): Promise<boolean> {
  const supabase = createServerClient();
  let currentError = error;

  const insertChat = async (agentName: string, agentTitle: string, content: string, turnType: string = "discussion") => {
    await supabase.from("chat_turns").insert({
      project_id: error.projectId,
      agent_name: agentName,
      agent_title: agentTitle,
      content,
      turn_type: turnType,
    });
  };

  const logGodEye = async (eventType: string, detail: string) => {
    await supabase.from("god_eye_log").insert({
      project_id: error.projectId,
      event_type: eventType,
      agent_name: "Morgan",
      detail,
    });
  };

  const morgan = getAgent("Morgan");
  const agentTitle = morgan?.title ?? "Reviewer";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await logGodEye("debug", attempt === 1 ? "Morgan debugging error from " + currentError.agentName + "…" : `Fix applied, attempt ${attempt}/${maxRetries}`);
    const result = await autoDebugError(currentError, projectContext);
    await insertChat("Morgan", agentTitle, result.analysis, "critique");

    if (!result.fixedCode) {
      await insertChat("System", "System", "Morgan could not produce an auto-fix. Please fix the code manually.");
      await logGodEye("debug", "Could not fix after " + attempt + " attempt(s).");
      return false;
    }

    const ue5Result = await executeInUE5(error.projectId, result.fixedCode, currentError.agentName);
    if (ue5Result.success) {
      await insertChat("System", "System", "🔧 Bug fixed by Morgan and re-executed successfully.");
      await logGodEye("debug_success", "Morgan auto-fixed UE5 error.");
      return true;
    }

    currentError = { ...currentError, code: result.fixedCode, error: ue5Result.error ?? "Execution failed" };
  }

  await insertChat("System", "System", `Could not fix after ${maxRetries} attempts.`);
  await logGodEye("debug", `Could not fix after ${maxRetries} attempts.`);
  return false;
}
