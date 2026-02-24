import { createServerClient } from "@/lib/supabase/server";
import { getQuickBuildPlan, detectSimplePrompt } from "@/lib/ue5/quickBuild";
import { sendToUE5AndWait, type ProjectTask } from "./projectMode";
import { validateUE5Code } from "@/lib/ue5/codeValidator";

async function insertProgressChat(projectId: string, content: string): Promise<void> {
  const supabase = createServerClient();
  await supabase.from("chat_turns").insert({
    project_id: projectId,
    agent_name: "System",
    agent_title: "Quick Build",
    content,
    turn_type: "discussion",
  });
}

export function isSimplePrompt(prompt: string): boolean {
  return detectSimplePrompt(prompt);
}

/** Run quick build: execute pre-built UE5 code steps in sequence. Uses same full_project_run table for progress. */
export async function runQuickBuild(
  projectId: string,
  bossPrompt: string
): Promise<{ runId: string; tasksCount: number; summary: string }> {
  const supabase = createServerClient();
  const steps = getQuickBuildPlan(bossPrompt);

  const tasks: (ProjectTask & { startedAt?: number; completedAt?: number })[] = steps.map((s, i) => ({
    id: `quick-${i}`,
    title: s.title,
    description: s.title,
    assignedTo: "Thomas",
    status: "pending",
    retries: 0,
    startedAt: undefined,
    completedAt: undefined,
  }));

  const { data: run, error: runError } = await supabase
    .from("full_project_run")
    .insert({
      project_id: projectId,
      boss_prompt: bossPrompt,
      status: "executing",
      current_task_index: 0,
      plan_json: tasks,
    })
    .select("id")
    .single();

  if (runError || !run) throw new Error("Failed to create run");
  const runId = run.id as string;

  await insertProgressChat(projectId, `⚡ Quick Build started: ${steps.length} steps (no AI wait)`);

  let completed = 0;
  let skipped = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const task = tasks[i];
    task.status = "in_progress";
    task.startedAt = Date.now();
    await supabase
      .from("full_project_run")
      .update({ current_task_index: i, plan_json: tasks, updated_at: new Date().toISOString() })
      .eq("id", runId);

    await insertProgressChat(projectId, `⏳ Step ${i + 1}/${steps.length}: ${step.title}…`);

    let codeToRun = step.code;
    const validation = validateUE5Code(step.code);
    if (validation.errors.length > 0) {
      codeToRun = validation.fixedCode;
    }

    const result = await sendToUE5AndWait(projectId, codeToRun, "Thomas");
    task.completedAt = Date.now();

    if (result.success) {
      task.status = "completed";
      completed++;
      await insertProgressChat(projectId, `✅ Step ${i + 1}/${steps.length}: ${step.title} done`);
    } else {
      task.status = "skipped";
      task.errorLog = result.error;
      skipped++;
      await insertProgressChat(projectId, `⏭️ Step ${i + 1}/${steps.length}: ${step.title} skipped — ${result.error?.slice(0, 50) ?? "error"}`);
    }

    await supabase
      .from("full_project_run")
      .update({ plan_json: tasks, updated_at: new Date().toISOString() })
      .eq("id", runId);
  }

  const summary = `🎉 Quick Build complete! ${completed}/${steps.length} steps succeeded.${skipped > 0 ? ` ${skipped} skipped.` : ""}`;
  await supabase
    .from("full_project_run")
    .update({ status: "completed", summary, updated_at: new Date().toISOString() })
    .eq("id", runId);
  await insertProgressChat(projectId, summary);

  return { runId, tasksCount: steps.length, summary };
}
