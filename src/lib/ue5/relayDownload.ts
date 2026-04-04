import { createServerClient } from "@/lib/supabase/server";

/** Stored in ue5_commands.import_context.relay_download (snake_case for relay Python). */
export type RelayDownloadKind = "polyhaven_fbx" | "http_mesh" | "sketchfab_zip";

export type RelayDownloadContext = {
  kind: RelayDownloadKind;
  url: string;
  /** Basename written under C:/GrandStudio/Downloads/ */
  filename: string;
  diffuseUrl?: string | null;
  /** Basename for diffuse, e.g. asset_diffuse.jpg */
  diffuseFilename?: string | null;
  /** Sketchfab: stem used for extracted model copy ({importStem}_model.glb|fbx|obj) */
  importStem?: string;
};

export function relayDownloadToDbPayload(ctx: RelayDownloadContext): Record<string, unknown> {
  return {
    kind: ctx.kind,
    url: ctx.url,
    filename: ctx.filename,
    ...(ctx.diffuseUrl != null && ctx.diffuseUrl !== ""
      ? { diffuse_url: ctx.diffuseUrl }
      : {}),
    ...(ctx.diffuseFilename != null && ctx.diffuseFilename !== ""
      ? { diffuse_filename: ctx.diffuseFilename }
      : {}),
    ...(ctx.importStem != null && ctx.importStem !== "" ? { import_stem: ctx.importStem } : {}),
  };
}

export async function waitForUE5CommandStatus(
  commandId: string,
  timeoutMs = 600_000
): Promise<"success" | "error" | "timeout"> {
  const supabase = createServerClient();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await supabase
      .from("ue5_commands")
      .select("status")
      .eq("id", commandId)
      .maybeSingle();
    if (data?.status === "success") return "success";
    if (data?.status === "error") return "error";
    await new Promise((r) => setTimeout(r, 2000));
  }
  return "timeout";
}
