import { createServerClient } from "@/lib/supabase/server";
import { callAgent } from "./runner";
import { getAgent, TEAM } from "./identity";
import { buildConsultationPrompt } from "./prompts";
import type { ChatMessage, ChatTurn, AgentName } from "./types";
import { getMemories, extractAndSaveMemories, buildMemoryContext } from "@/lib/memory/agentMemory";
import { shouldAutoConsult, startConsultation } from "./consultation";
import { triggerSketchfabFromResponse } from "@/lib/tools/sketchfab-trigger";

async function logGodEye(
  projectId: string,
  eventType: string,
  agentName: string,
  detail: string
) {
  const supabase = createServerClient();
  await supabase.from("god_eye_log").insert({
    project_id: projectId,
    event_type: eventType,
    agent_name: agentName,
    detail,
  });
}

async function saveChatTurn(
  projectId: string,
  agentName: string,
  agentTitle: string,
  content: string,
  turnType: string,
  taskId?: string
) {
  const supabase = createServerClient();
  await supabase.from("chat_turns").insert({
    project_id: projectId,
    agent_name: agentName,
    agent_title: agentTitle,
    content,
    turn_type: turnType,
    task_id: taskId ?? null,
  });
}

async function getProjectContext(projectId: string, agentName?: string): Promise<string> {
  const supabase = createServerClient();

  const memoryPromise = agentName
    ? getMemories(projectId, agentName, 10)
    : Promise.resolve([]);

  const [projectRes, loreRes, worldRes, recentChat, memories] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("game_lore").select("*").eq("project_id", projectId),
    supabase.from("world_state").select("*").eq("project_id", projectId),
    supabase
      .from("chat_turns")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20),
    memoryPromise,
  ]);

  const project = projectRes.data;
  const lore = loreRes.data ?? [];
  const world = worldRes.data ?? [];
  const chat = (recentChat.data ?? []).reverse();

  let ctx = `Project: ${project?.name ?? "Unknown"}\nInitial Brief: ${project?.initial_prompt ?? ""}\n`;

  if (lore.length > 0) {
    ctx += "\n--- GAME LORE ---\n";
    for (const l of lore) {
      ctx += `[${l.category}] ${l.key}: ${l.value}\n`;
    }
  }

  if (world.length > 0) {
    ctx += "\n--- WORLD STATE ---\n";
    for (const w of world) {
      ctx += `${w.entity_type}/${w.entity_id}: ${JSON.stringify(w.attributes)}\n`;
    }
  }

  if (chat.length > 0) {
    ctx += "\n--- RECENT CONVERSATION ---\n";
    for (const c of chat as ChatTurn[]) {
      ctx += `[${c.agent_name}] (${c.turn_type}): ${c.content.slice(0, 300)}\n`;
    }
  }

  if (memories.length > 0) {
    ctx += buildMemoryContext(memories);
  }

  return ctx;
}

export async function handleBossCommand(
  projectId: string,
  bossMessage: string
): Promise<void> {
  const discussionPrompt = `The Boss just said: "${bossMessage}"

You are in a team meeting. The Boss is the manager — they decide who does what.
Share your thoughts, ideas, and suggestions based on your expertise.
Do NOT assign tasks or take ownership unless the Boss tells you to.
Be concise. Address the Boss directly. Discuss what YOU could contribute if asked.`;

  for (const agent of TEAM) {
    const context = await getProjectContext(projectId, agent.name);
    await logGodEye(projectId, "api_call", agent.name, `Calling ${agent.model}`);

    try {
      const messages: ChatMessage[] = [
        { role: "user", content: discussionPrompt },
      ];

      const response = await callAgent(agent, messages, context);

      await logGodEye(projectId, "api_ok", agent.name, `Response received (${response.length} chars)`);
      await saveChatTurn(projectId, agent.name, agent.title, response, "discussion");

      await extractAndSaveMemories(projectId, agent.name, response, bossMessage);

      const { should, topic } = shouldAutoConsult(agent.name as AgentName, response);
      if (should) {
        await startConsultation(projectId, agent.name as AgentName, topic, response.slice(0, 1000), context);
      }
      await triggerSketchfabFromResponse(projectId, response);
    } catch (err) {
      await logGodEye(projectId, "error", agent.name, `API call failed: ${String(err)}`);
      await saveChatTurn(
        projectId,
        agent.name,
        agent.title,
        `I couldn't respond right now. Error: ${String(err).slice(0, 200)}`,
        "discussion"
      );
    }
  }

  await logGodEye(projectId, "turn", "System", "All agents have responded to Boss command");
}

export async function runNextTurn(projectId: string): Promise<{ done: boolean }> {
  const continuePrompt = `Continue the discussion based on what has been said so far.
The Boss is the manager and will assign tasks. Share any new thoughts, updates, or suggestions.
If you have nothing new to add, say so briefly.`;

  for (const agent of TEAM) {
    const context = await getProjectContext(projectId, agent.name);
    await logGodEye(projectId, "api_call", agent.name, `Calling ${agent.model}`);

    try {
      const messages: ChatMessage[] = [
        { role: "user", content: continuePrompt },
      ];

      const response = await callAgent(agent, messages, context);
      await logGodEye(projectId, "api_ok", agent.name, `Response (${response.length} chars)`);
      await saveChatTurn(projectId, agent.name, agent.title, response, "discussion");
      await extractAndSaveMemories(projectId, agent.name, response);
    } catch (err) {
      await logGodEye(projectId, "error", agent.name, `Failed: ${String(err)}`);
    }
  }

  return { done: false };
}

export async function runRouteDecision(projectId: string): Promise<void> {
  await runNextTurn(projectId);
}

export function extractUE5Code(response: string): string | null {
  const codeBlockRegex = /```python\n([\s\S]*?)```/g;
  const matches = [...response.matchAll(codeBlockRegex)];

  for (const match of matches) {
    const code = match[1];
    const ue5Keywords = [
      "unreal", "spawn", "actor", "EditorLevelLibrary", "EditorAssetLibrary",
      "StaticMesh", "Blueprint", "remote/object", "PCGComponent", "LandscapeProxy",
      "DynamicWeatherSystem", "EQS", "StateTree", "SmartObject", "MassEntity",
    ];
    if (ue5Keywords.some((kw) => code.toLowerCase().includes(kw.toLowerCase()))) {
      return code.trim();
    }
  }
  return null;
}

export async function runConsultationLoop(
  projectId: string,
  code: string,
  context: string,
  taskId: string
): Promise<boolean> {
  const reviewerNames = ["Nima", "Elena", "Morgan"] as const;

  for (const name of reviewerNames) {
    const agent = getAgent(name)!;
    const prompt = buildConsultationPrompt(name, code, context);

    await logGodEye(projectId, "api_call", agent.name, `Consultation review by ${agent.name}`);

    try {
      const response = await callAgent(
        agent,
        [{ role: "user", content: prompt }],
        context
      );

      await saveChatTurn(projectId, agent.name, agent.title, response, "consultation", taskId);
      await logGodEye(projectId, "api_ok", agent.name, "Consultation response received");

      if (name === "Morgan") {
        const rejected = /rejected?|blocked|abort|invalid/i.test(response);
        if (rejected) {
          await logGodEye(projectId, "error", "Morgan", "Code REJECTED by technical review");
          return false;
        }
      }
    } catch (err) {
      await logGodEye(projectId, "fallback", agent.name, `Consultation failed: ${String(err)}`);
    }
  }

  await logGodEye(projectId, "api_ok", "System", "Code APPROVED by consultation loop");
  return true;
}
