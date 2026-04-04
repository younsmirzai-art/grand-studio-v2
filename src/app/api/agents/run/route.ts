import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { askGrandStudioAI, isGreetingOrQuestion } from "@/lib/ai/grandStudioAI";
import { extractPythonCode } from "@/lib/ue5/extractPythonCode";
import { autoFixUE5Code } from "@/lib/ue5/autoFixer";
import { validateUE5Code } from "@/lib/ue5/validation";
import { rateLimitAI } from "@/lib/api/rateLimit";
import { resolveAssets, combineCodeWithImports, stripImportTags } from "@/lib/ai/assetResolver";
import type { ChatTurn } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const rl = await rateLimitAI(ip);
    if (rl.limited) return rl.response!;

    const { projectId, bossMessage } = await request.json();

    if (!projectId || !bossMessage) {
      return NextResponse.json(
        { error: "Missing projectId or bossMessage" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const [projectRes, recentChat] = await Promise.all([
      supabase.from("projects").select("name, initial_prompt").eq("id", projectId).single(),
      supabase
        .from("chat_turns")
        .select("agent_name, turn_type, content, screenshot_url")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const project = projectRes.data;
    const chat = (recentChat.data ?? []).reverse() as Pick<ChatTurn, "agent_name" | "turn_type" | "content" | "screenshot_url">[];

    let projectContext = `Project: ${project?.name ?? "Unknown"}\nBrief: ${project?.initial_prompt ?? ""}`;
    if (chat.length > 0) {
      projectContext += "\n\n--- RECENT CONVERSATION ---\n";
      for (const c of chat) {
        projectContext += `[${c.agent_name}] (${c.turn_type}): ${c.content.slice(0, 200)}${c.screenshot_url ? ` [Screenshot: ${c.screenshot_url}]` : ""}\n`;
      }
    }

    const trimmed = (bossMessage as string).trim();
    const finalMessage = isGreetingOrQuestion(trimmed)
      ? `The user is greeting you or asking a question. Respond with friendly text only. Do NOT write any Python code.\n\nUser: ${trimmed}`
      : trimmed;

    const { rawResponse } = await askGrandStudioAI(finalMessage, projectContext);

    let assetImportCode = "";
    try {
      const resolved = await resolveAssets(rawResponse, projectId);
      if (resolved.importCode) assetImportCode = resolved.importCode;
    } catch (e) {
      console.warn("[/api/agents/run] Asset resolution failed:", e);
    }

    const cleanedResponse = stripImportTags(rawResponse);

    await supabase.from("chat_turns").insert({
      project_id: projectId,
      agent_name: "Grand Studio",
      agent_title: "AI Co-Pilot",
      content: cleanedResponse,
      turn_type: "boss_command",
    });

    const pythonCode = extractPythonCode(cleanedResponse);
    if (pythonCode) {
      const { fixedCode } = autoFixUE5Code(pythonCode);
      const codeWithImports = assetImportCode
        ? combineCodeWithImports(fixedCode, assetImportCode)
        : fixedCode;
      const validation = validateUE5Code(codeWithImports);
      if (!validation.valid) {
        console.warn("[/api/agents/run] Code validation failed:", validation.errors);
      }
    }

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "api_ok",
      agent_name: "Grand Studio",
      detail: `Boss command processed (${rawResponse.length} chars)`,
    });

    return NextResponse.json({ success: true, response: rawResponse });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[/api/agents/run] Error:", err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
