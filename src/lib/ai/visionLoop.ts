import { createServerClient } from "@/lib/supabase/server";
import { extractPythonCode } from "@/lib/ue5/extractPythonCode";
import { autoFixUE5Code } from "@/lib/ue5/autoFixer";
import { validateUE5Code } from "@/lib/ue5/validation";
import { queueUE5Command } from "@/lib/ue5/commands";

const VISION_MODEL = "openai/gpt-4o";
const MAX_VISION_ROUNDS = 3;

export interface VisionResult {
  approved: boolean;
  score: number;
  feedback: string;
  fixedCode?: string;
  rounds: number;
}

export async function runVisionFeedbackLoop(
  projectId: string,
  originalPrompt: string,
  screenshotUrl: string
): Promise<VisionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const supabase = createServerClient();
  let currentScreenshotUrl = screenshotUrl;
  let totalRounds = 0;

  for (let round = 0; round < MAX_VISION_ROUNDS; round++) {
    totalRounds = round + 1;

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "screenshot",
      agent_name: "Vision AI",
      detail: `Vision round ${round + 1}/${MAX_VISION_ROUNDS} — evaluating screenshot`,
    });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://grand-studio-v2-prod.vercel.app",
        "X-Title": "Grand Studio",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a UE5 scene quality evaluator. The user requested: "${originalPrompt}"

Here is a screenshot of what was built in UE5.

Score this result from 1-10 based on:
- Does it match what the user asked for?
- Are objects properly placed (not overlapping, not floating)?
- Are materials/colors applied (not just white cubes)?
- Is the lighting appropriate?
- Is the scene complete (not missing major elements)?

If score >= 8, respond with: APPROVED. SCORE: [number]. [brief praise]

If score < 8, respond with:
SCORE: [number]
ISSUES: [list what's wrong]
Then write COMPLETE corrected Python code in a \`\`\`python code block that fixes the issues.
The code must be self-contained and follow all UE5 Python rules (import unreal, use EditorLevelLibrary, etc.)
Do NOT clear the level, just add/modify actors to fix issues.`,
              },
              {
                type: "image_url",
                image_url: { url: currentScreenshotUrl },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[visionLoop] OpenRouter error:", err.slice(0, 300));
      return { approved: false, score: 0, feedback: "Vision API error", rounds: totalRounds };
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const evaluation = data.choices?.[0]?.message?.content ?? "";

    const scoreMatch = evaluation.match(/SCORE:\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;

    await supabase.from("chat_turns").insert({
      project_id: projectId,
      agent_name: "Vision AI",
      agent_title: "Scene Evaluator",
      content: evaluation,
      turn_type: "execution",
      screenshot_url: currentScreenshotUrl,
    });

    if (evaluation.includes("APPROVED") || score >= 8) {
      await supabase.from("god_eye_log").insert({
        project_id: projectId,
        event_type: "api_ok",
        agent_name: "Vision AI",
        detail: `Scene APPROVED — score ${score}/10`,
      });
      return { approved: true, score, feedback: evaluation, rounds: totalRounds };
    }

    const fixCode = extractPythonCode(evaluation);
    if (!fixCode) {
      return { approved: false, score, feedback: evaluation, rounds: totalRounds };
    }

    const { fixedCode } = autoFixUE5Code(fixCode);
    const validation = validateUE5Code(fixedCode);
    if (!validation.valid) {
      return { approved: false, score, feedback: evaluation, rounds: totalRounds };
    }

    const commandId = await queueUE5Command(projectId, fixedCode);

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "execution",
      agent_name: "Vision AI",
      detail: `Fix code queued (command: ${commandId}), waiting for execution...`,
    });

    // Wait for UE5 execution + screenshot capture
    await new Promise(r => setTimeout(r, 10000));

    const { data: latestCmd } = await supabase
      .from("ue5_commands")
      .select("screenshot_url, status")
      .eq("project_id", projectId)
      .not("screenshot_url", "is", null)
      .order("executed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestCmd?.screenshot_url) {
      currentScreenshotUrl = latestCmd.screenshot_url;
    } else {
      return { approved: false, score, feedback: evaluation, fixedCode, rounds: totalRounds };
    }
  }

  return { approved: false, score: 0, feedback: "Max vision rounds reached", rounds: totalRounds };
}
