import { createServerClient } from "@/lib/supabase/server";
import { callAgent, callAgentRaw } from "./runner";
import { getAgent, TEAM } from "./identity";
import { buildTaskBreakdownPrompt, buildRoutingPrompt, buildConsultationPrompt } from "./prompts";
import type { ChatMessage, Task, ChatTurn, TaskBreakdown, AgentName } from "./types";

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

async function getProjectContext(projectId: string): Promise<string> {
  const supabase = createServerClient();

  const [projectRes, loreRes, worldRes, recentChat] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("game_lore").select("*").eq("project_id", projectId),
    supabase.from("world_state").select("*").eq("project_id", projectId),
    supabase
      .from("chat_turns")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20),
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

  return ctx;
}

export async function handleBossCommand(
  projectId: string,
  bossMessage: string
): Promise<void> {
  const nima = getAgent("Nima")!;

  await logGodEye(projectId, "thinking", "Nima", "Breaking down boss command into tasks...");

  const context = await getProjectContext(projectId);
  const taskPrompt = buildTaskBreakdownPrompt(bossMessage);

  await logGodEye(projectId, "api_call", "Nima", `Calling ${nima.provider}/${nima.model}`);

  const response = await callAgent(nima, [{ role: "user", content: taskPrompt }], context);

  await logGodEye(projectId, "api_ok", "Nima", "Task breakdown received");

  let breakdown: TaskBreakdown;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    breakdown = JSON.parse(jsonMatch[0]);
  } catch {
    await saveChatTurn(projectId, "Nima", "Project Manager", response, "discussion");
    await logGodEye(projectId, "error", "Nima", "Failed to parse task breakdown JSON");
    return;
  }

  await saveChatTurn(
    projectId,
    "Nima",
    "Project Manager",
    `بله ریس، در خدمتم! I've broken down your request into ${breakdown.tasks.length} tasks:\n\n${breakdown.tasks.map((t, i) => `${i + 1}. **${t.title}** → ${t.assigned_to}\n   ${t.description}`).join("\n\n")}`,
    "routing"
  );

  const supabase = createServerClient();
  for (let i = 0; i < breakdown.tasks.length; i++) {
    const t = breakdown.tasks[i];
    await supabase.from("tasks").insert({
      project_id: projectId,
      title: t.title,
      assigned_to: t.assigned_to,
      description: t.description,
      depends_on: t.depends_on,
      status: "pending",
      order_index: i,
    });
  }

  await logGodEye(projectId, "turn", "Nima", `Created ${breakdown.tasks.length} tasks`);
}

export async function runNextTurn(projectId: string): Promise<{ done: boolean }> {
  const supabase = createServerClient();

  const { data: pendingTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .in("status", ["pending", "in_progress"])
    .order("order_index", { ascending: true })
    .limit(1);

  if (!pendingTasks || pendingTasks.length === 0) {
    return { done: true };
  }

  const task = pendingTasks[0] as Task;
  const agent = getAgent(task.assigned_to as AgentName);

  if (!agent) {
    await logGodEye(projectId, "error", "System", `Unknown agent: ${task.assigned_to}`);
    return { done: false };
  }

  await supabase
    .from("tasks")
    .update({ status: "in_progress" })
    .eq("id", task.id);

  await logGodEye(projectId, "routing", "Nima", `Assigning task "${task.title}" to ${agent.name}`);
  await logGodEye(projectId, "thinking", agent.name, `Working on: ${task.title}`);

  const context = await getProjectContext(projectId);
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Task: ${task.title}\n\nDescription: ${task.description}\n\nPlease complete this task. If you need to write UE5 Python code, wrap it in \`\`\`python blocks.`,
    },
  ];

  await logGodEye(projectId, "api_call", agent.name, `Calling ${agent.provider}/${agent.model}`);

  let response: string;
  try {
    response = await callAgent(agent, messages, context);
    await logGodEye(projectId, "api_ok", agent.name, `Response received (${response.length} chars)`);
  } catch (err) {
    await logGodEye(projectId, "error", agent.name, `API call failed: ${String(err)}`);
    await supabase.from("tasks").update({ status: "rejected", result: String(err) }).eq("id", task.id);
    return { done: false };
  }

  await saveChatTurn(projectId, agent.name, agent.title, response, "proposal", task.id);

  const hasUE5Code = extractUE5Code(response);
  if (hasUE5Code) {
    await logGodEye(projectId, "turn", agent.name, "UE5 code detected — starting consultation loop");
    const approved = await runConsultationLoop(projectId, hasUE5Code, context, task.id);

    if (approved) {
      await supabase.from("ue5_commands").insert({
        project_id: projectId,
        code: hasUE5Code,
        status: "pending",
      });
      await logGodEye(projectId, "execution", agent.name, "Code queued for UE5 execution");
    }
  }

  await supabase
    .from("tasks")
    .update({ status: "completed", result: response.slice(0, 2000), completed_at: new Date().toISOString() })
    .eq("id", task.id);

  return { done: false };
}

function extractUE5Code(response: string): string | null {
  const codeBlockRegex = /```python\n([\s\S]*?)```/g;
  const matches = [...response.matchAll(codeBlockRegex)];

  for (const match of matches) {
    const code = match[1];
    const ue5Keywords = ["unreal", "spawn", "actor", "EditorLevelLibrary", "EditorAssetLibrary", "StaticMesh", "Blueprint", "remote/object"];
    if (ue5Keywords.some((kw) => code.toLowerCase().includes(kw.toLowerCase()))) {
      return code.trim();
    }
  }
  return null;
}

async function runConsultationLoop(
  projectId: string,
  code: string,
  context: string,
  taskId: string
): Promise<boolean> {
  const reviewers: { name: AgentName; role: string }[] = [
    { name: "Nima", role: "Nima" },
    { name: "Elena", role: "Elena" },
    { name: "Morgan", role: "Morgan" },
  ];

  for (const reviewer of reviewers) {
    const agent = getAgent(reviewer.name)!;
    const prompt = buildConsultationPrompt(reviewer.role, code, context);

    await logGodEye(projectId, "api_call", agent.name, `Consultation review by ${agent.name}`);

    try {
      const response = await callAgent(
        agent,
        [{ role: "user", content: prompt }],
        context
      );

      await saveChatTurn(projectId, agent.name, agent.title, response, "consultation", taskId);
      await logGodEye(projectId, "api_ok", agent.name, "Consultation response received");

      if (reviewer.name === "Morgan") {
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

export async function runRouteDecision(projectId: string): Promise<void> {
  const nima = getAgent("Nima")!;
  const context = await getProjectContext(projectId);
  const routingPrompt = buildRoutingPrompt(context);

  await logGodEye(projectId, "routing", "Nima", "Deciding who should speak next...");

  const response = await callAgentRaw(
    nima.name,
    nima.model,
    routingPrompt,
    [{ role: "user", content: "Who should speak next?" }],
    512
  );

  let nextAgent: string;
  let reason: string;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    const parsed = JSON.parse(jsonMatch[0]);
    nextAgent = parsed.next_agent;
    reason = parsed.reason;
  } catch {
    nextAgent = "Alex";
    reason = "Defaulting to architect";
  }

  await saveChatTurn(
    projectId,
    "Nima",
    "Project Manager",
    `Next speaker: **${nextAgent}** — ${reason}`,
    "routing"
  );

  const agent = getAgent(nextAgent as AgentName);
  if (!agent) return;

  const messages: ChatMessage[] = [
    { role: "user", content: "Continue the discussion based on what has been said so far. What are your thoughts?" },
  ];

  await logGodEye(projectId, "api_call", agent.name, `Calling ${agent.provider}/${agent.model}`);
  const agentResponse = await callAgent(agent, messages, context);
  await logGodEye(projectId, "api_ok", agent.name, `Response (${agentResponse.length} chars)`);

  await saveChatTurn(projectId, agent.name, agent.title, agentResponse, "discussion");
}
