import { NextRequest, NextResponse } from "next/server";
import { askGrandStudioAIStream, isGreetingOrQuestion } from "@/lib/ai/grandStudioAI";
import { handleAssetRequest, detectAssetImportRequest } from "@/lib/asset/assetRequestHandler";
import { queueRelayDownloadThenImport } from "@/lib/ue5/commands";
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

const MAX_ASSETS_IN_PROMPT = 1200;
const MAX_PER_CATEGORY = 220;
const LOG_CONTEXT_MAX = 120_000;

type ScanAsset = { name?: string; path?: string; type?: string };
type CategoryKey =
  | "BUILDINGS"
  | "LANDSCAPES"
  | "CHARACTERS"
  | "WALLS AND DECORATIONS"
  | "VEHICLES"
  | "TREES AND PLANTS"
  | "MATERIALS"
  | "OTHER";

type CategoryRule = {
  key: CategoryKey;
  roots: string[];
  keywords: string[];
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    key: "LANDSCAPES",
    roots: ["/Game/MWLandscapeAutoMaterial/"],
    keywords: ["landscape", "terrain", "mountain", "island", "desert", "ground", "heightmap", "map"],
  },
  {
    key: "BUILDINGS",
    roots: ["/Game/Fab/", "/Game/ProceduralBuildingGenerator/"],
    keywords: ["building", "house", "village", "town", "city", "roof", "floor", "window", "door", "cockpit", "tower"],
  },
  {
    key: "CHARACTERS",
    roots: ["/Game/Survival_Character/", "/Game/Characters/", "/Game/ThirdPerson/"],
    keywords: ["character", "player", "npc", "human", "mannequin", "skeletal", "anim"],
  },
  {
    key: "WALLS AND DECORATIONS",
    roots: ["/Game/Sankoolarts_CompoundWall_Kit/"],
    keywords: ["wall", "fence", "gate", "pillar", "compound", "decoration", "decor", "ornament"],
  },
  {
    key: "VEHICLES",
    roots: [],
    keywords: ["vehicle", "car", "truck", "van", "bus", "bike", "motorcycle", "boat", "ship", "plane", "aircraft", "helicopter", "tank"],
  },
  {
    key: "TREES AND PLANTS",
    roots: [],
    keywords: ["tree", "plant", "foliage", "bush", "grass", "leaf", "forest", "nature", "flower"],
  },
  {
    key: "MATERIALS",
    roots: [],
    keywords: ["material", "mat_", "mi_", "texture", "albedo", "normal", "roughness", "metallic"],
  },
];

function classifyAsset(path: string, type: string): CategoryKey {
  const p = path.toLowerCase();
  const t = type.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.roots.some((r) => p.startsWith(r.toLowerCase()))) return rule.key;
  }
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => p.includes(k) || t.includes(k))) return rule.key;
  }
  return "OTHER";
}

function buildCategorizedAssetSummary(assets: ScanAsset[]): {
  block: string;
  totalAssets: number;
  includedInPrompt: number;
  truncated: boolean;
  categoryCounts: Record<string, number>;
} {
  const normalized = assets
    .map((a) => ({
      path: (a.path || "").trim(),
      name: (a.name || "").trim(),
      type: (a.type || "Unknown").trim() || "Unknown",
    }))
    .filter((a) => a.path.startsWith("/Game/"));

  const byPath = new Map<string, { path: string; name: string; type: string }>();
  for (const a of normalized) {
    if (!byPath.has(a.path)) byPath.set(a.path, a);
  }
  const unique = [...byPath.values()];

  const categorized = new Map<CategoryKey, Array<{ path: string; name: string; type: string }>>();
  const rootsSeen = new Map<CategoryKey, Set<string>>();
  for (const k of ["BUILDINGS", "LANDSCAPES", "CHARACTERS", "WALLS AND DECORATIONS", "VEHICLES", "TREES AND PLANTS", "MATERIALS", "OTHER"] as CategoryKey[]) {
    categorized.set(k, []);
    rootsSeen.set(k, new Set<string>());
  }
  for (const asset of unique) {
    const cat = classifyAsset(asset.path, asset.type);
    categorized.get(cat)!.push(asset);
    const firstRoot = asset.path.split("/").slice(0, 3).join("/") + "/";
    rootsSeen.get(cat)!.add(firstRoot);
  }

  const lines: string[] = [`YOUR SCANNED ASSETS (${unique.length} total):`, ""];
  let included = 0;
  const categoryCounts: Record<string, number> = {};

  const ordered: CategoryKey[] = [
    "BUILDINGS",
    "LANDSCAPES",
    "CHARACTERS",
    "WALLS AND DECORATIONS",
    "VEHICLES",
    "TREES AND PLANTS",
    "MATERIALS",
    "OTHER",
  ];

  for (const cat of ordered) {
    const items = (categorized.get(cat) || []).sort((a, b) => a.path.localeCompare(b.path));
    categoryCounts[cat] = items.length;
    const roots = [...(rootsSeen.get(cat) || new Set<string>())].sort();
    const rootText = roots.length ? ` (found in ${roots.join(", ")})` : "";
    lines.push(`${cat}${rootText}:`);
    if (items.length === 0) {
      lines.push("\t∙\t(no matching assets found)");
      lines.push("");
      continue;
    }
    const remainingBudget = Math.max(0, MAX_ASSETS_IN_PROMPT - included);
    const cap = Math.min(MAX_PER_CATEGORY, remainingBudget);
    const toShow = items.slice(0, cap);
    for (const item of toShow) {
      lines.push(`\t∙\t${item.path} (${item.type})`);
    }
    included += toShow.length;
    if (toShow.length < items.length) {
      lines.push(`\t∙\t... and ${items.length - toShow.length} more in this category`);
    }
    lines.push("");
    if (included >= MAX_ASSETS_IN_PROMPT) {
      lines.push(`Prompt asset cap reached at ${MAX_ASSETS_IN_PROMPT} entries. Additional scanned assets omitted for token safety.`);
      break;
    }
  }

  const truncated = included < unique.length;

  return {
    block: lines.join("\n"),
    totalAssets: unique.length,
    includedInPrompt: included,
    truncated,
    categoryCounts,
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
    console.log("[BUILD STREAM] RECEIVED:", {
      prompt: body.prompt?.slice(0, 50),
      projectId: body.projectId,
      hasProjectContext: !!body.projectContext,
    });
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
      if (result?.relayDownload) {
        const fn = result.relayDownload.filename.toLowerCase();
        const fileType = fn.endsWith(".zip") ? "zip" : fn.split(".").pop() ?? "fbx";
        await queueRelayDownloadThenImport(projectId, result.relayDownload, result.importCode, {
          source_provider: result.platformUsed === "sketchfab" ? "sketchfab" : "polyhaven",
          source_url: result.relayDownload.url,
          file_type: fileType,
        });
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
        console.log("[BUILD STREAM] About to fetch scanned assets for userId:", userId, "projectId:", projectId);
        const supabase = createServerClient();
        const assets = await fetchLatestScannedAssetsForUserAndProject(supabase, userId, projectId);
        console.log("[BUILD STREAM] Scanned assets result: count=", assets.length, "firstPath=", assets[0]?.path);
        if (assets.length > 0) {
          const formatted = buildCategorizedAssetSummary(assets);
          console.log(
            `[BUILD STREAM] Scanned assets found: ${formatted.totalAssets} | sending ${formatted.includedInPrompt} categorized assets${formatted.truncated ? " (truncated)" : ""}`
          );
          console.log("[BUILD STREAM] Category counts:", JSON.stringify(formatted.categoryCounts));
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
