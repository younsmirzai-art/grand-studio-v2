import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { askGrandStudioAIStream, isGreetingOrQuestion } from "@/lib/ai/grandStudioAI";
import { handleAssetRequest, detectAssetImportRequest } from "@/lib/asset/assetRequestHandler";
import { queueUE5Command } from "@/lib/ue5/commands";
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

    const trimmed = (message as string).trim();

    if (detectAssetImportRequest(trimmed)) {
      const result = await handleAssetRequest(trimmed, projectId);
      if (result) {
        await queueUE5Command(projectId, result.importCode);
        await supabase.from("chat_turns").insert({
          project_id: projectId,
          agent_name: "Grand Studio",
          agent_title: "AI Co-Pilot",
          content: result.chatMessage,
          turn_type: "direct",
        });
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: result.chatMessage })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, fullContent: result.chatMessage })}\n\n`));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store",
          },
        });
      }
    }

    const finalMessage = isGreetingOrQuestion(trimmed)
      ? `The user is greeting you or asking a question. Respond with friendly text only. Do NOT write any Python code.\n\nUser: ${trimmed}`
      : trimmed;

    const upstreamBody = await askGrandStudioAIStream(finalMessage, projectContext);
    const reader = upstreamBody.getReader();
    const decoder = new TextDecoder();

    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });

            const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
            for (const line of lines) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (typeof delta === "string") {
                  fullContent += delta;
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify({ content: delta })}\n\n`)
                  );
                }
              } catch {
                /* ignore parse errors on partial chunks */
              }
            }
          }

          if (fullContent) {
            await supabase.from("chat_turns").insert({
              project_id: projectId,
              agent_name: "Grand Studio",
              agent_title: "AI Co-Pilot",
              content: stripImportTags(fullContent),
              turn_type: "direct",
            });

            let assetImportCode = "";
            try {
              const resolved = await resolveAssets(fullContent);
              if (resolved.importCode) assetImportCode = resolved.importCode;
            } catch (e) {
              console.warn("[stream] Asset resolution failed:", e);
            }

            const cleanedContent = stripImportTags(fullContent);
            const pythonCode = extractPythonCode(cleanedContent);
            if (pythonCode) {
              const { fixedCode } = autoFixUE5Code(pythonCode);
              const codeWithImports = assetImportCode
                ? combineCodeWithImports(fixedCode, assetImportCode)
                : fixedCode;
              const validation = validateUE5Code(codeWithImports);
              if (validation.valid) {
                await queueUE5Command(projectId, codeWithImports);
              }
            }
          }

          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ done: true, fullContent })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[/api/agents/direct/stream] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
