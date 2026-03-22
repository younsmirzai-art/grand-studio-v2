import { createServerClient } from "@/lib/supabase/server";
import { askGrandStudioAI } from "@/lib/ai/grandStudioAI";
import { extractPythonCode } from "@/lib/ue5/extractPythonCode";
import { autoFixUE5Code } from "@/lib/ue5/autoFixer";
import { validateUE5Code } from "@/lib/ue5/validation";

export interface ImportContext {
  source_provider: string;
  source_url: string;
  file_type: string;
  preview_image_url?: string;
}

export async function queueUE5Command(
  projectId: string,
  code: string,
  options?: {
    commandType?: "import" | "scan_assets" | "screenshot" | "capture" | "execute";
    importContext?: ImportContext;
  }
): Promise<string> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("ue5_commands")
    .insert({
      project_id: projectId,
      code,
      status: "pending",
      ...(options?.commandType && { command_type: options.commandType }),
      ...(options?.importContext && { import_context: options.importContext }),
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to queue UE5 command: ${error.message}`);
  return data.id;
}

export async function runAutoDebugLoop(
  projectId: string,
  commandId: string,
  maxRetries: number = 2
): Promise<boolean> {
  const supabase = createServerClient();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await new Promise(r => setTimeout(r, 3000));

    const { data: cmd } = await supabase
      .from("ue5_commands")
      .select("*")
      .eq("id", commandId)
      .single();

    if (!cmd || cmd.status !== "error") return cmd?.status === "success";

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "debug",
      agent_name: "Auto-Fix",
      detail: `Retry ${attempt + 1}/${maxRetries}: ${cmd.error_log?.slice(0, 200)}`,
    });

    try {
      const { rawResponse } = await askGrandStudioAI(
        `This UE5 Python code failed with an error. Fix it.\n\nError: ${cmd.error_log}\n\nOriginal code:\n\`\`\`python\n${cmd.code}\n\`\`\`\n\nWrite the COMPLETE corrected Python code.`,
        `Project ${projectId} — auto-fix attempt ${attempt + 1}`
      );

      const fixedPython = extractPythonCode(rawResponse);
      if (!fixedPython) continue;

      const { fixedCode } = autoFixUE5Code(fixedPython);
      const validation = validateUE5Code(fixedCode);
      if (!validation.valid) continue;

      commandId = await queueUE5Command(projectId, fixedCode);

      await supabase.from("god_eye_log").insert({
        project_id: projectId,
        event_type: "debug_success",
        agent_name: "Auto-Fix",
        detail: `Fix queued as new command ${commandId}`,
      });

      await new Promise(r => setTimeout(r, 5000));
    } catch (e) {
      console.error("[autoDebugLoop] Error:", e);
    }
  }

  const { data: finalCmd } = await supabase
    .from("ue5_commands")
    .select("status")
    .eq("id", commandId)
    .single();

  if (finalCmd?.status === "success") return true;

  await supabase.from("god_eye_log").insert({
    project_id: projectId,
    event_type: "error",
    agent_name: "Auto-Fix",
    detail: "Auto-fix exhausted all retries.",
  });

  await supabase.from("chat_turns").insert({
    project_id: projectId,
    agent_name: "Grand Studio",
    agent_title: "AI Co-Pilot",
    content: "Auto-fix could not resolve the UE5 error after multiple attempts. Check the God-Eye log for details and try a different approach.",
    turn_type: "execution",
  });

  return false;
}
