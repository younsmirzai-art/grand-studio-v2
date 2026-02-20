import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { callAgent } from "@/lib/agents/runner";
import { getAgent } from "@/lib/agents/identity";
import type { ChatMessage, ChatTurn, AgentName } from "@/lib/agents/types";
import { getMemories, extractAndSaveMemories, buildMemoryContext } from "@/lib/memory/agentMemory";
import { shouldAutoConsult, startConsultation } from "@/lib/agents/consultation";
import { buildUE5CapabilitiesContext } from "@/lib/ue5/plugin-registry";

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

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "api_call",
      agent_name: agent.name,
      detail: `Direct message from Boss to ${agent.name}`,
    });

    const [projectRes, loreRes, recentChat, memories] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("game_lore").select("*").eq("project_id", projectId),
      supabase.from("chat_turns").select("*").eq("project_id", projectId)
        .order("created_at", { ascending: false }).limit(15),
      getMemories(projectId, agent.name, 10),
    ]);

    const project = projectRes.data;
    const lore = loreRes.data ?? [];
    const chat = (recentChat.data ?? []).reverse();
    const memoryCtx = buildMemoryContext(memories);

    let context = `Project: ${project?.name ?? "Unknown"}\nBrief: ${project?.initial_prompt ?? ""}\n`;
    if (lore.length > 0) {
      context += "\n--- GAME LORE ---\n";
      for (const l of lore) context += `[${l.category}] ${l.key}: ${l.value}\n`;
    }
    if (chat.length > 0) {
      context += "\n--- RECENT CONVERSATION ---\n";
      for (const c of chat as ChatTurn[]) {
        context += `[${c.agent_name}] (${c.turn_type}): ${c.content.slice(0, 200)}\n`;
      }
    }
    context += memoryCtx;
    context += "\n" + buildUE5CapabilitiesContext();

    const directPrompt = `The Boss (ریس) is speaking DIRECTLY to you in a private conversation.
This is a direct message — only you are responding. Give your full attention and expertise.

Boss says: "${message}"`;

    const messages: ChatMessage[] = [
      { role: "user", content: directPrompt },
    ];

    const response = await callAgent(agent, messages, context);

    await supabase.from("chat_turns").insert({
      project_id: projectId,
      agent_name: agent.name,
      agent_title: agent.title,
      content: response,
      turn_type: "direct",
    });

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "api_ok",
      agent_name: agent.name,
      detail: `Direct response (${response.length} chars)`,
    });

    await extractAndSaveMemories(projectId, agent.name, response, message);

    const { should, topic } = shouldAutoConsult(agent.name as AgentName, response);
    if (should) {
      await startConsultation(projectId, agent.name as AgentName, topic, response.slice(0, 1000), context);
    }

    return NextResponse.json({ success: true, response });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[/api/agents/direct] Error:", err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
