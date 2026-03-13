import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { askGrandStudioAI } from "@/lib/ai/grandStudioAI";
import { extractPythonCode } from "@/lib/ue5/extractPythonCode";
import { autoFixUE5Code } from "@/lib/ue5/autoFixer";
import { validateUE5Code } from "@/lib/ue5/validation";
import { queueUE5Command } from "@/lib/ue5/commands";
import { rateLimitAI } from "@/lib/api/rateLimit";
import { resolveAssets, combineCodeWithImports, stripImportTags } from "@/lib/ai/assetResolver";
import type { ChatTurn } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const rl = await rateLimitAI(ip);
    if (rl.limited) return rl.response!;

    const { projectId, message } = await request.json();

    if (!projectId || !message) {
      return NextResponse.json(
        { error: "Missing projectId or message" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const [projectRes, recentChat] = await Promise.all([
      supabase.from("projects").select("name, initial_prompt").eq("id", projectId).single(),
      supabase
        .from("chat_turns")
        .select("agent_name, turn_type, content")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const project = projectRes.data;
    const chat = (recentChat.data ?? []).reverse() as Pick<ChatTurn, "agent_name" | "turn_type" | "content">[];

    let projectContext = `Project: ${project?.name ?? "Unknown"}\nBrief: ${project?.initial_prompt ?? ""}`;
    if (chat.length > 0) {
      projectContext += "\n\n--- RECENT CONVERSATION ---\n";
      for (const c of chat) {
        projectContext += `[${c.agent_name}] (${c.turn_type}): ${c.content.slice(0, 200)}\n`;
      }
    }

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "api_call",
      agent_name: "Grand Studio",
      detail: `Direct message from Boss`,
    });

    const { rawResponse } = await askGrandStudioAI(message, projectContext);

    let assetImportCode = "";
    try {
      const resolved = await resolveAssets(rawResponse);
      if (resolved.importCode) assetImportCode = resolved.importCode;
    } catch (e) {
      console.warn("[/api/agents/direct] Asset resolution failed:", e);
    }

    const cleanedResponse = stripImportTags(rawResponse);

    await supabase.from("chat_turns").insert({
      project_id: projectId,
      agent_name: "Grand Studio",
      agent_title: "AI Co-Pilot",
      content: cleanedResponse,
      turn_type: "direct",
    });

    const pythonCode = extractPythonCode(cleanedResponse);
    if (pythonCode) {
      const { fixedCode } = autoFixUE5Code(pythonCode);
      const codeWithImports = assetImportCode
        ? combineCodeWithImports(fixedCode, assetImportCode)
        : fixedCode;
      const validation = validateUE5Code(codeWithImports);
      if (validation.valid) {
        await queueUE5Command(projectId, codeWithImports);
      } else {
        console.warn("[/api/agents/direct] Code validation failed:", validation.errors);
      }
    }

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "api_ok",
      agent_name: "Grand Studio",
      detail: `Direct response (${rawResponse.length} chars)`,
    });

    return NextResponse.json({ success: true, response: rawResponse });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[/api/agents/direct] Error:", err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
