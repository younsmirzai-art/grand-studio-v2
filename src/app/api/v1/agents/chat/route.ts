import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { callAgent } from "@/lib/agents/runner";
import { getAgent } from "@/lib/agents/identity";
import type { ChatMessage, ChatTurn, AgentName } from "@/lib/agents/types";
import { getMemories, buildMemoryContext } from "@/lib/memory/agentMemory";
import { buildUE5CapabilitiesContext } from "@/lib/ue5/plugin-registry";
import { extractPythonCode } from "@/lib/agents/projectMode";
import { validateApiKey, unauthorizedResponse } from "@/lib/api/auth";

const AGENT_NAME_MAP: Record<string, AgentName> = {
  nima: "Nima",
  alex: "Alex",
  thomas: "Thomas",
  elena: "Elena",
  morgan: "Morgan",
  sana: "Sana",
  amir: "Amir",
};

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { projectId, agent: agentParam, message } = body as {
      projectId?: string;
      agent?: string;
      message?: string;
    };
    if (!projectId || !agentParam || !message) {
      return NextResponse.json(
        { error: "Missing projectId, agent, or message" },
        { status: 400 }
      );
    }

    const agentName = AGENT_NAME_MAP[agentParam.toLowerCase()] ?? (agentParam as AgentName);
    const agent = getAgent(agentName);
    if (!agent) {
      return NextResponse.json(
        { error: `Unknown agent: ${agentParam}. Use: nima, alex, thomas, elena, morgan, sana, amir` },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const [projectRes, loreRes, recentChat, memories] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("game_lore").select("*").eq("project_id", projectId),
      supabase
        .from("chat_turns")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(15),
      getMemories(projectId, agent.name, 10),
    ]);

    const project = projectRes.data;
    const lore = loreRes.data ?? [];
    const chat = (recentChat.data ?? []).reverse();
    const memoryCtx = buildMemoryContext(memories);

    let context = `Project: ${project?.name ?? "Unknown"}\nBrief: ${(project as { initial_prompt?: string })?.initial_prompt ?? ""}\n`;
    if (lore.length > 0) {
      context += "\n--- GAME LORE ---\n";
      for (const l of lore as { category: string; key: string; value: string }[]) {
        context += `[${l.category}] ${l.key}: ${l.value}\n`;
      }
    }
    if (chat.length > 0) {
      context += "\n--- RECENT CONVERSATION ---\n";
      for (const c of chat as ChatTurn[]) {
        context += `[${c.agent_name}] (${c.turn_type}): ${c.content.slice(0, 200)}\n`;
      }
    }
    context += memoryCtx;
    context += "\n" + buildUE5CapabilitiesContext();

    const userPrompt = `The user is sending you a direct message. Respond concisely. If they ask for UE5 code, output it in a \`\`\`python code block.\n\nUser: "${message}"`;

    const messages: ChatMessage[] = [{ role: "user", content: userPrompt }];
    const response = await callAgent(agent, messages, context);

    const code = extractPythonCode(response);

    return NextResponse.json({
      agentName: agent.name,
      response,
      code: code ?? undefined,
    });
  } catch (error) {
    console.error("[v1/agents/chat]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
