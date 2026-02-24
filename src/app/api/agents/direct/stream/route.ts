import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAgent } from "@/lib/agents/identity";
import type { ChatMessage, ChatTurn, AgentName } from "@/lib/agents/types";
import { getMemories, extractAndSaveMemories, buildMemoryContext } from "@/lib/memory/agentMemory";
import { shouldAutoConsult, startConsultation } from "@/lib/agents/consultation";
import { buildUE5CapabilitiesContext } from "@/lib/ue5/plugin-registry";
import { buildSystemPrompt } from "@/lib/agents/prompts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(request: NextRequest) {
  try {
    const { projectId, agentName, message } = await request.json();

    if (!projectId || !agentName || !message) {
      return NextResponse.json(
        { error: "Missing projectId, agentName, or message" },
        { status: 400 }
      );
    }

    const agent = getAgent(agentName as AgentName);
    if (!agent) {
      return NextResponse.json(
        { error: `Unknown agent: ${agentName}` },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const [projectRes, loreRes, recentChat, memories] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("game_lore").select("*").eq("project_id", projectId),
      supabase.from("chat_turns").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(15),
      getMemories(projectId, agent.name, 10),
    ]);

    const project = projectRes.data;
    const lore = loreRes.data ?? [];
    const chat = (recentChat.data ?? []).reverse();
    const memoryCtx = buildMemoryContext(memories);
    let context = `Project: ${project?.name ?? "Unknown"}\nBrief: ${project?.initial_prompt ?? ""}\n`;
    if (Array.isArray(lore) && lore.length > 0) {
      context += "\n--- GAME LORE ---\n";
      for (const l of lore) context += `[${(l as { category: string; key: string; value: string }).category}] ${(l as { category: string; key: string; value: string }).key}: ${(l as { category: string; key: string; value: string }).value}\n`;
    }
    if (chat.length > 0) {
      context += "\n--- RECENT CONVERSATION ---\n";
      for (const c of chat as ChatTurn[]) context += `[${c.agent_name}] (${c.turn_type}): ${c.content.slice(0, 200)}\n`;
    }
    context += memoryCtx + "\n" + buildUE5CapabilitiesContext();

    const systemPrompt = buildSystemPrompt(agent, context);
    const directPrompt = `The Boss is speaking DIRECTLY to you in a private conversation. Only you are responding.\n\nBoss says: "${message}"`;
    const messages: ChatMessage[] = [{ role: "user", content: directPrompt }];

    const apiKey = process.env.OPENROUTER_API_KEY ?? "";
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://grand-studio-v2.vercel.app",
        "X-Title": "Grand Studio v2",
      },
      body: JSON.stringify({
        model: agent.model,
        max_tokens: agent.maxTokens,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const err = await res.text();
      return NextResponse.json({ error: err || "OpenRouter error" }, { status: res.status });
    }

    let fullContent = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
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
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
                }
              } catch {
                /* ignore parse */
              }
            }
          }
          if (fullContent) {
            await supabase.from("chat_turns").insert({
              project_id: projectId,
              agent_name: agent.name,
              agent_title: agent.title,
              content: fullContent,
              turn_type: "direct",
            });
            await extractAndSaveMemories(projectId, agent.name, fullContent, message);
            const { should, topic } = shouldAutoConsult(agent.name as AgentName, fullContent);
            if (should) {
              await startConsultation(projectId, agent.name as AgentName, topic, fullContent.slice(0, 1000), context);
            }
          }
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true, fullContent })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[/api/agents/direct/stream] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
