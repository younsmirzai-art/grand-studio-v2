import { createServerClient } from "@/lib/supabase/server";
import { getAgent } from "./identity";
import { callAgent } from "./runner";
import { buildSystemPrompt } from "./prompts";
import { buildProjectContext } from "./projectMode";
import type { ChatMessage } from "./types";

export interface PlaytestReport {
  score: number;
  criticalIssues: string[];
  warnings: string[];
  minorIssues: string[];
  positives: string[];
  suggestions: string[];
  screenshotUrl?: string;
  rawResponse?: string;
}

export type PlaytestFocusArea = "visual" | "gameplay" | "performance" | "design" | "all";

export interface PlaytestRequest {
  projectId: string;
  screenshotUrl?: string;
  focusArea?: PlaytestFocusArea;
}

function extractSection(text: string, header: string): string[] {
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escaped}[^:]*:\\s*([\\s\\S]*?)(?=🔴|🟡|🟢|✅|💡|Score:|$)`, "i");
  const match = text.match(regex);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

export function parsePlaytestReport(response: string): PlaytestReport {
  const scoreMatch = response.match(/Score:\s*(\d+)\/10/i);
  const score = scoreMatch ? Math.min(10, Math.max(0, parseInt(scoreMatch[1], 10))) : 5;
  return {
    score,
    criticalIssues: extractSection(response, "🔴 Critical"),
    warnings: extractSection(response, "🟡 Warning"),
    minorIssues: extractSection(response, "🟢 Minor"),
    positives: extractSection(response, "✅ What"),
    suggestions: extractSection(response, "💡 Suggestion"),
    rawResponse: response,
  };
}

async function getRecentExecutions(projectId: string, limit: number): Promise<{ code: string; agent_name: string }[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("ue5_commands")
    .select("code, agent_name")
    .eq("project_id", projectId)
    .order("executed_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as { code: string; agent_name: string }[];
}

export async function runPlaytest(request: PlaytestRequest): Promise<PlaytestReport> {
  const { projectId, screenshotUrl, focusArea = "all" } = request;
  const amir = getAgent("Amir");
  if (!amir) {
    return {
      score: 0,
      criticalIssues: ["Amir (Playtester) not configured."],
      warnings: [],
      minorIssues: [],
      positives: [],
      suggestions: [],
    };
  }

  let prompt = "Run a thorough playtest analysis of the current UE5 scene.";
  if (screenshotUrl) {
    prompt += `\n\nHere is a screenshot of the current UE5 scene. Analyze this screenshot for visual bugs, design issues, and improvements.\n\n[Screenshot: ${screenshotUrl}]`;
  }
  if (focusArea && focusArea !== "all") {
    prompt += `\n\nFocus specifically on: ${focusArea} issues.`;
  }

  const recentCode = await getRecentExecutions(projectId, 10);
  if (recentCode.length > 0) {
    prompt += "\n\nRecent code executed in UE5:\n";
    recentCode.forEach((exec, i) => {
      prompt += `\n--- Execution ${i + 1} (${exec.agent_name}) ---\n${(exec.code || "").slice(0, 800)}\n`;
    });
  }

  const context = await buildProjectContext(projectId);

  let response: string;
  if (screenshotUrl) {
    const systemPrompt = buildSystemPrompt(amir, context);
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://grand-studio-v2.vercel.app",
        "X-Title": "Grand Studio v2",
      },
      body: JSON.stringify({
        model: amir.model,
        max_tokens: amir.maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: screenshotUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Playtest vision API error: ${await res.text()}`);
    const data = await res.json();
    response = data.choices?.[0]?.message?.content ?? "";
  } else {
    const messages: ChatMessage[] = [{ role: "user", content: prompt }];
    response = await callAgent(amir, messages, context);
  }

  const report = parsePlaytestReport(response);
  report.screenshotUrl = screenshotUrl;
  return report;
}

export function formatReportAsMessage(report: PlaytestReport): string {
  const parts: string[] = ["[PLAYTEST REPORT]", `Score: ${report.score}/10`];
  if (report.criticalIssues.length) parts.push(`🔴 Critical Issues: ${report.criticalIssues.join("; ")}`);
  if (report.warnings.length) parts.push(`🟡 Warnings: ${report.warnings.join("; ")}`);
  if (report.minorIssues.length) parts.push(`🟢 Minor Issues: ${report.minorIssues.join("; ")}`);
  if (report.positives.length) parts.push(`✅ What's Good: ${report.positives.join("; ")}`);
  if (report.suggestions.length) parts.push(`💡 Suggestions: ${report.suggestions.join("; ")}`);
  return parts.join("\n\n");
}

/** Parse a saved chat message back into a PlaytestReport for rendering the card. */
export function parsePlaytestReportFromMessage(content: string): PlaytestReport | null {
  if (!content.includes("[PLAYTEST REPORT]")) return null;
  return parsePlaytestReport(content);
}
