import { NextRequest, NextResponse } from "next/server";
import { askGrandStudioAIStream, isGreetingOrQuestion } from "@/lib/ai/grandStudioAI";
import { handleAssetRequest, detectAssetImportRequest } from "@/lib/asset/assetRequestHandler";
import { queueUE5Command } from "@/lib/ue5/commands";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";

const UPGRADE_MSG_AI = "You've used all 10 free AI messages today. Upgrade to Pro for unlimited messages!";
const UPGRADE_MSG_IMPORT = "You've reached your daily import limit. Upgrade to Pro for unlimited imports!";

function streamJsonError(message: string): Response {
  const encoder = new TextEncoder();
  const body = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message, limitReached: true })}\n\n`));
    controller.close();
  };
  return new Response(new ReadableStream({ start: body }), {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

const MAX_STATIC_MESH_IN_PROMPT = 400;
const LOG_CONTEXT_MAX = 120_000;

function isStaticMeshType(type: string | undefined): boolean {
  if (!type || typeof type !== "string") return false;
  const t = type.trim();
  const collapsed = t.replace(/\s+/g, "").toLowerCase();
  if (collapsed.includes("staticmesh")) return true;
  const short = t.includes(".") ? t.split(".").pop()!.trim() : t;
  const norm = short.replace(/\s+/g, "").toLowerCase();
  return norm === "staticmesh";
}

/** e.g. /Game/Fab/foo/bar -> "Fab" (first folder under /Game) */
function gameSubfolderLabel(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts[0]?.toLowerCase() !== "game") return "Other";
  return parts[1] || "Game";
}

/**
 * StaticMesh only, grouped by first /Game subfolder. Caps list for token limits.
 */
function buildStaticMeshScanForPrompt(assets: Array<{ name?: string; path?: string; type?: string }>): {
  block: string;
  staticMeshTotal: number;
  includedInPrompt: number;
  truncated: boolean;
} {
  const staticMeshes = assets.filter((a) => isStaticMeshType(a.type));
  if (staticMeshes.length === 0 && assets.length > 0) {
    const sample = assets
      .slice(0, 60)
      .map((a) => `\t∙\t${(a.path || a.name || "").trim()} (${(a.type || "Unknown").trim()})`)
      .join("\n");
    return {
      block: [
        "USER'S AVAILABLE ASSETS (from UE5 scan):",
        `No rows are typed as StaticMesh in the DB (${assets.length} assets scanned with other type strings).`,
        "Still prefer unreal.EditorAssetLibrary.load_asset() + spawn_actor_from_object() for paths below that are meshes; sample rows:",
        sample,
      ].join("\n"),
      staticMeshTotal: 0,
      includedInPrompt: Math.min(60, assets.length),
      truncated: false,
    };
  }

  const truncated = staticMeshes.length > MAX_STATIC_MESH_IN_PROMPT;
  const list = truncated ? staticMeshes.slice(0, MAX_STATIC_MESH_IN_PROMPT) : staticMeshes;

  const byFolder = new Map<string, Array<{ name?: string; path?: string; type?: string }>>();
  for (const a of list) {
    const p = (a.path || "").trim();
    const label = gameSubfolderLabel(p || "/Game/Unknown");
    if (!byFolder.has(label)) byFolder.set(label, []);
    byFolder.get(label)!.push(a);
  }

  const lines: string[] = [
    "USER'S AVAILABLE ASSETS (from UE5 scan):",
    "Below are StaticMesh assets you can place with unreal.EditorAssetLibrary.load_asset(PATH) and unreal.EditorLevelLibrary.spawn_actor_from_object(mesh, location).",
  ];
  if (truncated) {
    lines.push(
      `(Showing ${MAX_STATIC_MESH_IN_PROMPT} of ${staticMeshes.length} StaticMesh assets — prefer these paths; more exist in the project.)`
    );
  }

  const folders = [...byFolder.keys()].sort((a, b) => a.localeCompare(b));
  for (const folder of folders) {
    const items = (byFolder.get(folder) || []).sort((x, y) =>
      (x.path || "").localeCompare(y.path || "", undefined, { sensitivity: "base" })
    );
    lines.push("");
    lines.push(`${folder}:`);
    for (const item of items) {
      const path = (item.path || item.name || "").trim();
      lines.push(`\t∙\t${path} (StaticMesh)`);
    }
  }

  return {
    block: lines.join("\n"),
    staticMeshTotal: staticMeshes.length,
    includedInPrompt: list.length,
    truncated,
  };
}

async function fetchLatestScannedAssetsForUserAndProject(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  projectId: string
): Promise<Array<{ name?: string; path?: string; type?: string }>> {
  const { data: exact, error: e1 } = await supabase
    .from("scanned_assets")
    .select("assets")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  const exactAssets = (exact?.assets as Array<{ name?: string; path?: string; type?: string }>) ?? [];
  if (exactAssets.length > 0) return exactAssets;

  const { data: latest, error: e2 } = await supabase
    .from("scanned_assets")
    .select("assets")
    .eq("user_id", userId)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e2) throw new Error(e2.message);
  return (latest?.assets as Array<{ name?: string; path?: string; type?: string }>) ?? [];
}

export async function POST(request: NextRequest) {
  console.log("[BUILD STREAM] Request received");
  try {
    const supabaseAuth = await createServerAuthClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const body = await request.json();
    const { prompt, projectContext, projectId } = body;
    console.log("[BUILD STREAM] Body keys:", Object.keys(body), "prompt length:", typeof prompt === "string" ? prompt.length : 0);

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing prompt" },
        { status: 400 }
      );
    }

    const trimmed = prompt.trim();
    const importDetected = detectAssetImportRequest(trimmed);
    console.log("[BUILD STREAM] Checking if import request:", !!importDetected, "projectId:", !!projectId);
    if (importDetected) {
      console.log("[BUILD STREAM] Import detected — platform:", importDetected.platform, "query:", importDetected.query);
    }

    if (importDetected && projectId) {
      const platform = importDetected.platform;
      const checkPoly = platform === "polyhaven" || platform === "both";
      const checkSketch = platform === "sketchfab" || platform === "both";
      if (checkPoly) {
        const polyCheck = await checkUsageLimit(userId, "polyhaven_import");
        if (!polyCheck.allowed) {
          return streamJsonError("You've reached your daily model import limit. Upgrade to Pro for unlimited imports!");
        }
      }
      if (checkSketch) {
        const sketchCheck = await checkUsageLimit(userId, "sketchfab_import");
        if (!sketchCheck.allowed) {
          return streamJsonError("You've reached your daily community import limit. Upgrade to Pro for unlimited imports!");
        }
      }

      console.log("[BUILD STREAM] Handling import directly — NOT calling AI");
      const result = await handleAssetRequest(trimmed, projectId);
      console.log("[BUILD STREAM] handleAssetRequest result:", result ? "success" : "null");

      if (result?.platformUsed) {
        await recordUsage(userId, result.platformUsed === "polyhaven" ? "polyhaven_import" : "sketchfab_import");
      }

      const encoder = new TextEncoder();
      const streamBody = result
        ? (controller: ReadableStreamDefaultController<Uint8Array>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: result!.chatMessage } }] })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, fullContent: result!.chatMessage })}\n\n`));
            controller.close();
          }
        : (controller: ReadableStreamDefaultController<Uint8Array>) => {
            const msg = "Couldn't find that model. Try a different search term or browse the Asset Library tabs.";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: msg } }] })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, fullContent: msg })}\n\n`));
            controller.close();
          };
      if (result) {
        await queueUE5Command(projectId, result.importCode);
      }
      return new Response(new ReadableStream({ start: streamBody }), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const aiCheck = await checkUsageLimit(userId, "ai_message");
    if (!aiCheck.allowed) {
      return streamJsonError(UPGRADE_MSG_AI);
    }

    const finalPrompt = isGreetingOrQuestion(trimmed)
      ? `The user is greeting you or asking a question. Respond with friendly text only. Do NOT write any Python code.\n\nUser: ${trimmed}`
      : trimmed;

    let scannedAssetsContext = "";

    if (projectId && !isGreetingOrQuestion(trimmed)) {
      try {
        const supabase = createServerClient();
        const assets = await fetchLatestScannedAssetsForUserAndProject(supabase, userId, projectId);
        if (assets.length > 0) {
          const formatted = buildStaticMeshScanForPrompt(assets);
          console.log(
            `[BUILD STREAM] Scanned assets found: ${assets.length} total rows in DB snapshot | StaticMesh: ${formatted.staticMeshTotal} (sending ${formatted.includedInPrompt} in prompt${formatted.truncated ? ", truncated" : ""})`
          );
          const preview = assets.slice(0, 10).map((a) => ({
            name: a.name ?? "",
            path: a.path ?? "",
            type: a.type ?? "",
          }));
          console.log("[BUILD STREAM] First 10 scanned rows (any type):", JSON.stringify(preview));
          scannedAssetsContext = formatted.block;
        } else {
          console.log("[BUILD STREAM] No scanned assets found (no rows for user/project or empty assets array)");
        }
      } catch (e) {
        console.error("[BUILD STREAM] Scanned assets load failed:", e instanceof Error ? e.message : e);
      }
    }

    await recordUsage(userId, "ai_message");

    const enrichedContext = [projectContext, scannedAssetsContext].filter(Boolean).join("\n\n");

    if (!isGreetingOrQuestion(trimmed)) {
      const ctx = enrichedContext || "";
      const logSlice = ctx.length > LOG_CONTEXT_MAX ? `${ctx.slice(0, LOG_CONTEXT_MAX)}\n… [log truncated, total ${ctx.length} chars]` : ctx;
      console.log(
        `[BUILD STREAM] --- FULL PROMPT CONTEXT SENT TO AI (projectContext + asset list) — ${ctx.length} chars ---\n${logSlice}\n[BUILD STREAM] --- END CONTEXT ---`
      );
      console.log("[BUILD STREAM] User message to model:", finalPrompt.slice(0, 2000));
    }

    const stream = await askGrandStudioAIStream(finalPrompt, enrichedContext || undefined, {
      logFullMessages: !isGreetingOrQuestion(trimmed),
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[BUILD STREAM] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
