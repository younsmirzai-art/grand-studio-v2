import { createServerClient } from "@/lib/supabase/server";
import { askGrandStudioAI } from "@/lib/ai/grandStudioAI";
import { extractPythonCode } from "@/lib/ue5/extractPythonCode";
import { autoFixUE5Code } from "@/lib/ue5/autoFixer";
import { validateUE5Code } from "@/lib/ue5/validation";
import {
  relayDownloadToDbPayload,
  type RelayDownloadContext,
} from "@/lib/ue5/relayDownload";

export type { RelayDownloadContext } from "@/lib/ue5/relayDownload";

export interface ImportContext {
  source_provider: string;
  source_url: string;
  file_type: string;
  preview_image_url?: string;
}

export type UE5CommandType =
  | "import"
  | "download"
  | "scan_assets"
  | "screenshot"
  | "capture"
  | "execute";

const RELAY_DOWNLOAD_PLACEHOLDER = "# relay-download (handled by local relay, not UE5)";

/** Queue a relay-side download only (no UE5 Python). */
export async function queueRelayDownloadCommand(
  projectId: string,
  download: RelayDownloadContext
): Promise<string> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("ue5_commands")
    .insert({
      project_id: projectId,
      code: RELAY_DOWNLOAD_PLACEHOLDER,
      status: "pending",
      command_type: "download",
      import_context: { relay_download: relayDownloadToDbPayload(download) },
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to queue relay download: ${error.message}`);
  console.log(`RELAY DOWNLOAD QUEUED: id=${data.id} project=${projectId}`);
  return data.id;
}

/** Relay downloads to disk, then UE5 runs import Python on local paths. */
export async function queueRelayDownloadThenImport(
  projectId: string,
  download: RelayDownloadContext,
  importCode: string,
  importContext?: ImportContext
): Promise<{ downloadCommandId: string; importCommandId: string }> {
  const payload = relayDownloadToDbPayload(download);
  console.log(
    "[queueRelayDownloadThenImport] project=%s relay_download=%s",
    projectId,
    JSON.stringify({
      kind: download.kind,
      url: download.url?.slice(0, 120),
      filename: download.filename,
      diffuseUrl: download.diffuseUrl != null ? `${String(download.diffuseUrl).slice(0, 80)}…` : null,
      diffuseFilename: download.diffuseFilename ?? null,
      importStem: download.importStem ?? null,
      dbPayloadKeys: Object.keys(payload),
    })
  );
  const downloadCommandId = await queueRelayDownloadCommand(projectId, download);
  const importCommandId = await queueUE5Command(projectId, importCode, {
    commandType: "import",
    importContext,
  });
  return { downloadCommandId, importCommandId };
}

export async function queueUE5Command(
  projectId: string,
  code: string,
  options?: {
    commandType?: UE5CommandType;
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
  console.log(`COMMAND QUEUED: id=${data.id} project=${projectId} type=${options?.commandType ?? "default"}`);
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
