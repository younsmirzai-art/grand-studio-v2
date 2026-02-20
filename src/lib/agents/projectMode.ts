import { createServerClient } from "@/lib/supabase/server";
import { getAgent } from "./identity";
import type { AgentName } from "./types";
import { buildSystemPrompt } from "./prompts";
import { buildUE5CapabilitiesContext } from "@/lib/ue5/plugin-registry";
import { getMemories, buildMemoryContext } from "@/lib/memory/agentMemory";
import { buildTrailerPlan, generateTrailerCode } from "@/lib/trailer/trailerEngine";

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  code?: string;
  result?: string;
  errorLog?: string;
  retries: number;
}

export interface ProjectPlan {
  projectId: string;
  runId: string;
  tasks: ProjectTask[];
  currentTaskIndex: number;
  status: "planning" | "executing" | "paused" | "stopped" | "completed" | "failed";
}

const AGENT_NAMES_LIST = ["Nima", "Alex", "Thomas", "Elena", "Morgan", "Sana"] as const;
const MAX_RETRIES = 3;
const AGENT_RESPONSE_TIMEOUT_MS = 60_000;
const UE5_WAIT_TIMEOUT_MS = 120_000;
const UE5_POLL_INTERVAL_MS = 2000;
const PAUSE_POLL_MS = 2000;

export function extractPythonCode(text: string): string | null {
  const match = text.match(/```python\s*\n?([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

function parseNimaTaskLines(text: string): ProjectTask[] {
  const tasks: ProjectTask[] = [];
  const lines = text.split(/\r?\n/);
  let index = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.toUpperCase().startsWith("TASK|")) continue;
    const parts = trimmed.split("|").map((p) => p.trim());
    if (parts.length < 4) continue;
    const agent = parts[parts.length - 1];
    if (!AGENT_NAMES_LIST.includes(agent as (typeof AGENT_NAMES_LIST)[number])) continue;
    const title = parts[1];
    const description = parts.slice(2, -1).join(" | ");
    tasks.push({
      id: `task-${index}`,
      title,
      description,
      assignedTo: agent,
      status: "pending",
      retries: 0,
    });
    index++;
  }
  return tasks;
}

async function buildProjectContext(projectId: string): Promise<string> {
  const supabase = createServerClient();
  const [projectRes, loreRes, memories] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("game_lore").select("*").eq("project_id", projectId),
    getMemories(projectId, "Nima", 5),
  ]);
  const project = projectRes.data as { name?: string; initial_prompt?: string } | null;
  const lore = (loreRes.data ?? []) as { category: string; key: string; value: string }[];
  const memoryCtx = buildMemoryContext(memories);
  let ctx = `Project: ${project?.name ?? "Unknown"}\nBrief: ${project?.initial_prompt ?? ""}\n`;
  if (lore.length > 0) {
    ctx += "\n--- GAME LORE ---\n";
    for (const l of lore) ctx += `[${l.category}] ${l.key}: ${l.value}\n`;
  }
  ctx += memoryCtx + "\n" + buildUE5CapabilitiesContext();
  return ctx;
}

export async function askNimaToCreatePlan(projectId: string, bossPrompt: string): Promise<ProjectTask[]> {
  const supabase = createServerClient();
  const nima = getAgent("Nima");
  if (!nima) throw new Error("Nima not found");

  const context = await buildProjectContext(projectId);
  const systemPrompt = buildSystemPrompt(nima, context);
  const userPrompt = `The Boss wants to run a FULL PROJECT. Break it down into ordered tasks that will be executed one by one in UE5.

Boss request: "${bossPrompt}"

Reply with a list of tasks. Each task must be on its own line in EXACTLY this format (no other text on the line):
TASK|Short Title|Detailed description for the agent|AssignedAgent

Example:
TASK|Create terrain|Use Landmass to create base terrain and heightmap|Thomas
TASK|Add lighting|Set up directional light and sky atmosphere|Thomas

Rules:
- Use 4 to 8 tasks.
- AssignedAgent must be exactly one of: Nima, Alex, Thomas, Elena, Morgan, Sana.
- Order tasks logically (e.g. terrain before trees).
- End your reply with the task lines only; you can add a short intro line before them if needed.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AGENT_RESPONSE_TIMEOUT_MS);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://grand-studio-v2.vercel.app",
      "X-Title": "Grand Studio v2",
    },
    body: JSON.stringify({
      model: nima.model,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  clearTimeout(timeout);
  if (!response.ok) throw new Error(`Nima plan failed: ${response.status}`);
  const data = await response.json();
  const content = (data.choices?.[0]?.message?.content as string) ?? "";
  const tasks = parseNimaTaskLines(content);
  if (tasks.length === 0) {
    const fallback: ProjectTask[] = [
      { id: "task-0", title: "Execute project", description: bossPrompt, assignedTo: "Thomas", status: "pending", retries: 0 },
    ];
    return fallback;
  }
  return tasks;
}

export async function getRunStatus(projectId: string): Promise<"running" | "paused" | "stopped" | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("full_project_run")
    .select("status")
    .eq("project_id", projectId)
    .in("status", ["planning", "executing", "paused", "stopped"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const s = data?.status as string | undefined;
  if (s === "paused") return "paused";
  if (s === "stopped") return "stopped";
  if (s === "executing" || s === "planning") return "running";
  return null;
}

export async function waitForPauseOrStop(projectId: string): Promise<"running" | "stopped"> {
  while (true) {
    const status = await getRunStatus(projectId);
    if (status === "stopped") return "stopped";
    if (status === "running") return "running";
    await new Promise((r) => setTimeout(r, PAUSE_POLL_MS));
  }
}

export async function insertProgressChat(projectId: string, content: string): Promise<void> {
  const supabase = createServerClient();
  await supabase.from("chat_turns").insert({
    project_id: projectId,
    agent_name: "System",
    agent_title: "Full Project",
    content,
    turn_type: "discussion",
  });
}

async function sendToUE5AndWait(projectId: string, code: string, agentName: string): Promise<{ success: boolean; commandId?: string; result?: string; error?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const res = await fetch(`${baseUrl}/api/ue5/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, code, agentName }),
  });
  const data = await res.json();
  if (!res.ok || !data.commandId) {
    return { success: false, error: data.error ?? "Failed to queue" };
  }
  const commandId = data.commandId as string;
  const supabase = createServerClient();
  const deadline = Date.now() + UE5_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { data: cmd } = await supabase.from("ue5_commands").select("status, result, error_log").eq("id", commandId).single();
    if (cmd) {
      if (cmd.status === "success") return { success: true, commandId, result: cmd.result as string };
      if (cmd.status === "error") return { success: false, commandId, error: (cmd.error_log as string) ?? "Execution failed" };
    }
    await new Promise((r) => setTimeout(r, UE5_POLL_INTERVAL_MS));
  }
  return { success: false, commandId, error: "Execution timeout" };
}

async function sendToAgentWithTimeout(projectId: string, agentName: AgentName, taskDescription: string): Promise<string> {
  const agent = getAgent(agentName);
  if (!agent) throw new Error(`Agent ${agentName} not found`);
  const context = await buildProjectContext(projectId);
  const systemPrompt = buildSystemPrompt(agent, context);
  const userPrompt = `You are working on a Full Project task. Write UE5 Python code to complete this task. Output ONLY the code in a \`\`\`python code block. No explanation outside the block.

Task: ${taskDescription}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AGENT_RESPONSE_TIMEOUT_MS);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://grand-studio-v2.vercel.app",
      "X-Title": "Grand Studio v2",
    },
    body: JSON.stringify({
      model: agent.model,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  clearTimeout(timeout);
  if (!response.ok) throw new Error(`Agent ${agentName} failed: ${response.status}`);
  const data = await response.json();
  return (data.choices?.[0]?.message?.content as string) ?? "";
}

async function askMorganToReview(projectId: string, contextSummary: string): Promise<void> {
  const morgan = getAgent("Morgan");
  if (!morgan) return;
  const context = await buildProjectContext(projectId);
  const systemPrompt = buildSystemPrompt(morgan, context);
  const userPrompt = `You are reviewing progress during a Full Project run. Briefly review and confirm everything looks good so far, or note any concerns in 1-2 sentences.

Context: ${contextSummary}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AGENT_RESPONSE_TIMEOUT_MS);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://grand-studio-v2.vercel.app",
      "X-Title": "Grand Studio v2",
    },
    body: JSON.stringify({
      model: morgan.model,
      max_tokens: 512,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  clearTimeout(timeout);
  if (!response.ok) return;
  const data = await response.json();
  const content = (data.choices?.[0]?.message?.content as string) ?? "";
  const supabase = createServerClient();
  await supabase.from("chat_turns").insert({
    project_id: projectId,
    agent_name: "Morgan",
    agent_title: "Reviewer",
    content,
    turn_type: "critique",
  });
}

export async function startFullProject(projectId: string, bossPrompt: string): Promise<{ runId: string; tasksCount: number; summary: string }> {
  const supabase = createServerClient();

  const { data: run, error: runError } = await supabase
    .from("full_project_run")
    .insert({
      project_id: projectId,
      boss_prompt: bossPrompt,
      status: "planning",
      plan_json: [],
    })
    .select("id")
    .single();

  if (runError || !run) throw new Error("Failed to create run");
  const runId = run.id as string;

  await insertProgressChat(projectId, `📋 Full Project started: "${bossPrompt.slice(0, 80)}${bossPrompt.length > 80 ? "…" : ""}"`);

  const tasks = await askNimaToCreatePlan(projectId, bossPrompt);
  const planJson = tasks.map((t) => ({ ...t }));

  await supabase
    .from("full_project_run")
    .update({ status: "executing", plan_json: planJson, updated_at: new Date().toISOString() })
    .eq("id", runId)
    .select()
    .single();

  await insertProgressChat(projectId, `📋 Project Plan Created: ${tasks.length} tasks`);

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < tasks.length; i++) {
    let status = await getRunStatus(projectId);
    if (status === "paused") {
      await insertProgressChat(projectId, "⏸️ Project paused. Click Resume to continue.");
      const next = await waitForPauseOrStop(projectId);
      if (next === "stopped") break;
    }
    if (status === "stopped") {
      await insertProgressChat(projectId, "⏹️ Project stopped by Boss.");
      break;
    }

    const task = tasks[i];
    task.status = "in_progress";
    await supabase.from("full_project_run").update({ current_task_index: i, plan_json: tasks, updated_at: new Date().toISOString() }).eq("id", runId);

    await insertProgressChat(projectId, `⏳ Task ${i + 1}/${tasks.length}: ${task.title}… (${task.assignedTo})`);

    let lastError: string | undefined;
    let success = false;

    for (let attempt = 0; attempt <= MAX_RETRIES && !success; attempt++) {
      try {
        const agentResponse = await sendToAgentWithTimeout(projectId, task.assignedTo as AgentName, task.description);
        if (task.assignedTo === "Sana") {
          await supabase.from("chat_turns").insert({
            project_id: projectId,
            agent_name: "Sana",
            agent_title: "Composer",
            content: agentResponse,
            turn_type: "discussion",
          });
          task.status = "completed";
          success = true;
          completed++;
          await insertProgressChat(projectId, `✅ Task ${i + 1}/${tasks.length}: Complete!`);
          break;
        }
        const code = extractPythonCode(agentResponse);
        if (!code || !code.includes("import unreal")) {
          lastError = "No valid UE5 Python code in response";
          task.retries = attempt + 1;
          continue;
        }
        const ue5Result = await sendToUE5AndWait(projectId, code, task.assignedTo);
        if (ue5Result.success) {
          task.status = "completed";
          task.result = ue5Result.result;
          success = true;
          completed++;
          await insertProgressChat(projectId, `✅ Task ${i + 1}/${tasks.length}: Complete!`);
        } else {
          lastError = ue5Result.error;
          task.retries = attempt + 1;
          task.errorLog = ue5Result.error;
          if (attempt < MAX_RETRIES) {
            await insertProgressChat(projectId, `🔄 Retry ${attempt + 1}/${MAX_RETRIES} for task ${i + 1}…`);
          }
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        task.retries = attempt + 1;
      }
    }

    if (!success) {
      task.status = "failed";
      task.errorLog = lastError;
      failed++;
      await insertProgressChat(projectId, `❌ Task ${i + 1}/${tasks.length}: Failed after ${MAX_RETRIES} retries. Continuing.`);
    }

    if ((i + 1) % 2 === 0 && i + 1 < tasks.length) {
      await insertProgressChat(projectId, `🔍 Morgan reviewing tasks 1–${i + 1}…`);
      await askMorganToReview(projectId, `Tasks 1–${i + 1} completed. ${completed} succeeded, ${failed} failed.`);
    }
  }

  const runStatusBeforeTrailer = await getRunStatus(projectId);
  if (runStatusBeforeTrailer !== "stopped" && tasks.length > 0) {
    await insertProgressChat(projectId, `🎬 Creating cinematic trailer… (Thomas)`);
    try {
      const trailerPlan = buildTrailerPlan("epic_reveal", "Cinematic Trailer", "1080p");
      const trailerCode = generateTrailerCode(trailerPlan);
      const ue5Result = await sendToUE5AndWait(projectId, trailerCode, "Thomas");
      if (ue5Result.success) {
        await insertProgressChat(projectId, `✅ Trailer cameras placed. Use Sequencer and Movie Pipeline to animate and render.`);
      } else {
        await insertProgressChat(projectId, `⚠️ Trailer camera placement failed: ${ue5Result.error}`);
      }
    } catch (e) {
      await insertProgressChat(projectId, `⚠️ Trailer step error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const finalStatus = (await getRunStatus(projectId)) === "stopped" ? "stopped" : failed > 0 ? "completed" : "completed";
  const summary = `🎉 Project ${finalStatus === "stopped" ? "stopped" : "complete"}! ${completed}/${tasks.length} tasks succeeded, ${failed} failed.`;
  await supabase
    .from("full_project_run")
    .update({ status: finalStatus, plan_json: tasks, summary, updated_at: new Date().toISOString() })
    .eq("id", runId);
  await insertProgressChat(projectId, summary);

  return { runId, tasksCount: tasks.length, summary };
}
