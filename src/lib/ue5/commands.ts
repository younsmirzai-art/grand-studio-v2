import { createServerClient } from "@/lib/supabase/server";

export async function queueUE5Command(
  projectId: string,
  code: string
): Promise<string> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("ue5_commands")
    .insert({
      project_id: projectId,
      code,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to queue UE5 command: ${error.message}`);
  return data.id;
}

export async function runAutoDebugLoop(
  projectId: string,
  commandId: string,
  maxRetries: number = 3
): Promise<boolean> {
  const supabase = createServerClient();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: cmd } = await supabase
      .from("ue5_commands")
      .select("*")
      .eq("id", commandId)
      .single();

    if (!cmd || cmd.status !== "error") return cmd?.status === "success";

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "error",
      agent_name: "System",
      detail: `Auto-debug attempt ${attempt + 1}/${maxRetries}: ${cmd.error_log?.slice(0, 200)}`,
    });

    const fixResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/agents/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        bossMessage: `Fix this UE5 code. Error: ${cmd.error_log}\n\nOriginal code:\n\`\`\`python\n${cmd.code}\n\`\`\``,
      }),
    });

    if (!fixResponse.ok) continue;

    await new Promise((r) => setTimeout(r, 5000));
  }

  await supabase.from("god_eye_log").insert({
    project_id: projectId,
    event_type: "error",
    agent_name: "System",
    detail: "Auto-debug exhausted all retries. Boss notification required.",
  });

  await supabase.from("chat_turns").insert({
    project_id: projectId,
    agent_name: "System",
    agent_title: "Auto-Debug",
    content: "Auto-debug failed after 3 attempts. Please check the God-Eye log for details.",
    turn_type: "discussion",
  });

  return false;
}
