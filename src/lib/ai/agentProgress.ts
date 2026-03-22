import { createServerClient } from "@/lib/supabase/server";
import type { SceneRequest } from "@/lib/ai/sceneSchema";
import type { AssetSourceMode } from "@/lib/ai/sceneSchema";

export type AgentPhase = "search" | "import" | "place" | "screenshot" | "completed";

export type SerializedAssetCandidate = {
  id: string;
  name: string;
  source: "polyhaven" | "sketchfab" | "scanned";
  objectType: string;
  category: string;
  polyId?: string;
  sketchfabUid?: string;
  downloadCount: number;
  scanPath?: string | null;
};

export type ImportedAssetRecord = {
  jobId: string;
  path: string;
  objectType: string;
  category: string;
};

/** Snapshot after search phase (or partial search) for resume */
export type SearchSnapshot = {
  pathsReadyByType: Record<string, string[]>;
  candidateByKey: Record<string, SerializedAssetCandidate>;
  searchRowIndex: number;
  /** JSON of flattened scene rows for resume */
  rowsSerialized: string;
};

export type AgentProgressRow = {
  id: string;
  user_id: string;
  project_id: string;
  session_id: string;
  scene_request: SceneRequest;
  asset_source: AssetSourceMode;
  phase: AgentPhase;
  search_results: SearchSnapshot | unknown[] | null;
  import_queue: SerializedAssetCandidate[];
  imported_assets: ImportedAssetRecord[];
  imported_count: number;
  total_imports: number;
  placement_done: boolean;
  screenshot_done: boolean;
  status: string;
  error_message: string | null;
  cumulative_elapsed_ms: number;
  created_at: string;
  updated_at: string;
};

export function parseSearchSnapshot(raw: unknown): SearchSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.searchRowIndex === "number" && o.pathsReadyByType && o.candidateByKey) {
    return {
      pathsReadyByType: o.pathsReadyByType as Record<string, string[]>,
      candidateByKey: o.candidateByKey as Record<string, SerializedAssetCandidate>,
      searchRowIndex: o.searchRowIndex,
      rowsSerialized: typeof o.rowsSerialized === "string" ? o.rowsSerialized : "[]",
    };
  }
  return null;
}

export async function insertAgentProgress(args: {
  userId: string;
  projectId: string;
  sessionId: string;
  sceneRequest: SceneRequest;
  assetSource: AssetSourceMode;
}): Promise<{ id: string }> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("agent_progress")
    .insert({
      user_id: args.userId,
      project_id: args.projectId,
      session_id: args.sessionId,
      scene_request: args.sceneRequest,
      asset_source: args.assetSource,
      phase: "search",
      search_results: [],
      import_queue: [],
      imported_assets: [],
      imported_count: 0,
      total_imports: 0,
      placement_done: false,
      screenshot_done: false,
      status: "in_progress",
      cumulative_elapsed_ms: 0,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`agent_progress insert: ${error.message}`);
  return { id: data!.id as string };
}

export async function getAgentProgressBySession(
  sessionId: string,
  userId: string,
): Promise<AgentProgressRow | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("agent_progress")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data);
}

function mapRow(data: Record<string, unknown>): AgentProgressRow {
  return {
    id: String(data.id),
    user_id: String(data.user_id),
    project_id: String(data.project_id),
    session_id: String(data.session_id),
    scene_request: data.scene_request as SceneRequest,
    asset_source: data.asset_source as AssetSourceMode,
    phase: data.phase as AgentPhase,
    search_results: data.search_results as SearchSnapshot | unknown[] | null,
    import_queue: (data.import_queue as SerializedAssetCandidate[]) ?? [],
    imported_assets: (data.imported_assets as ImportedAssetRecord[]) ?? [],
    imported_count: Number(data.imported_count ?? 0),
    total_imports: Number(data.total_imports ?? 0),
    placement_done: Boolean(data.placement_done),
    screenshot_done: Boolean(data.screenshot_done),
    status: String(data.status ?? "in_progress"),
    error_message: data.error_message != null ? String(data.error_message) : null,
    cumulative_elapsed_ms: Number(data.cumulative_elapsed_ms ?? 0),
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
  };
}

export async function updateAgentProgress(
  id: string,
  patch: Partial<{
    phase: AgentPhase;
    search_results: unknown;
    import_queue: SerializedAssetCandidate[];
    imported_assets: ImportedAssetRecord[];
    imported_count: number;
    total_imports: number;
    placement_done: boolean;
    screenshot_done: boolean;
    status: string;
    error_message: string | null;
    cumulative_elapsed_ms: number;
  }>,
): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("agent_progress")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`agent_progress update: ${error.message}`);
}

const STALE_MS = 10 * 60 * 1000;
const CLEANUP_AGE_MS = 24 * 60 * 60 * 1000;

export function isStaleProgress(row: AgentProgressRow): boolean {
  if (row.status !== "in_progress") return false;
  const t = new Date(row.updated_at).getTime();
  return Date.now() - t > STALE_MS;
}

/** Mark stale in_progress rows: reset phase work so next continue restarts current phase */
export async function handleStaleSession(row: AgentProgressRow): Promise<AgentProgressRow> {
  const supabase = createServerClient();
  if (row.phase === "search") {
    await supabase
      .from("agent_progress")
      .update({
        search_results: [],
        phase: "search",
        error_message: "Stale session (>10m): restarted search phase",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return {
      ...row,
      search_results: [],
      phase: "search",
      error_message: "Stale session (>10m): restarted search phase",
    };
  }
  if (row.phase === "import") {
    const snap = parseSearchSnapshot(row.search_results);
    const fullQueue = row.import_queue?.length
      ? row.import_queue
      : [];
    await supabase
      .from("agent_progress")
      .update({
        imported_count: 0,
        imported_assets: [],
        import_queue: fullQueue,
        phase: "import",
        error_message: "Stale session (>10m): restarted import phase from beginning",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return {
      ...row,
      imported_count: 0,
      imported_assets: [],
      import_queue: fullQueue,
      phase: "import",
      error_message: "Stale session (>10m): restarted import phase from beginning",
    };
  }
  if (row.phase === "place" || row.phase === "screenshot") {
    await supabase
      .from("agent_progress")
      .update({
        placement_done: false,
        screenshot_done: false,
        phase: "place",
        error_message: "Stale session (>10m): will retry placement",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return {
      ...row,
      placement_done: false,
      screenshot_done: false,
      phase: "place",
      error_message: "Stale session (>10m): will retry placement",
    };
  }
  return row;
}

export async function deleteOldCompletedSessions(): Promise<void> {
  const supabase = createServerClient();
  const cutoff = new Date(Date.now() - CLEANUP_AGE_MS).toISOString();
  await supabase.from("agent_progress").delete().eq("status", "completed").lt("updated_at", cutoff);
}
