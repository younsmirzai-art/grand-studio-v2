import { NextRequest, NextResponse } from "next/server";
import { autoFixUE5Code } from "@/lib/ue5/autoFixer";
import { extractPythonCode } from "@/lib/ue5/extractPythonCode";
import { createServerClient } from "@/lib/supabase/server";
import { resolveAssets, combineCodeWithImports, stripImportTags } from "@/lib/ai/assetResolver";
import { enrichCodeWithPolyHavenAssets } from "@/lib/asset/assetRequestHandler";

const DANGEROUS_PATTERNS = [
  "os.system",
  "subprocess",
  "eval(",
  "exec(",
  "__import__",
  "shutil.rmtree",
  "os.remove",
  "os.rmdir",
];

const CLEANUP_SCRIPT = `
import unreal
el = unreal.EditorLevelLibrary
actors = el.get_all_level_actors()
prefixes = ('Sky', 'Sun', 'SkyLight', 'Clouds', 'Fog', 'Ground', 'House_', 'Wall_', 'Roof', 'Door', 'Tree_', 'Light_', 'Torch_', 'PostProcess', 'PathStone_', 'Pool', 'Fence_', 'Column_', 'Driveway', 'Tower_', 'Gate')
for actor in actors:
    try:
        label = actor.get_actor_label()
        for p in prefixes:
            if label.startswith(p) or label == p:
                actor.destroy_actor()
                break
    except Exception:
        pass
unreal.log('Scene cleared')
`;

export async function POST(request: NextRequest) {
  console.log("[BUILD EXECUTE] Request received");
  try {
    const body = await request.json();
    const { projectId, rawResponse, userPrompt } = body;
    console.log("[BUILD EXECUTE] Body keys:", Object.keys(body), "projectId:", projectId, "rawResponse length:", typeof rawResponse === "string" ? rawResponse.length : 0);

    if (!projectId || typeof rawResponse !== "string") {
      return NextResponse.json(
        { error: "Missing projectId or rawResponse" },
        { status: 400 }
      );
    }

    // Resolve asset import tags (Poly Haven / Sketchfab) before extracting code
    let processedResponse = rawResponse;
    let assetImportCode = "";
    try {
      const resolved = await resolveAssets(rawResponse, projectId);
      if (resolved.importCode) {
        assetImportCode = resolved.importCode;
        console.log(`[BUILD EXECUTE] Resolved ${resolved.imports.length} asset imports`);
      }
      processedResponse = stripImportTags(rawResponse);
    } catch (e) {
      console.warn("[BUILD EXECUTE] Asset resolution failed, continuing without imports:", e);
    }

    const code = extractPythonCode(processedResponse);
    if (!code || !code.includes("import unreal")) {
      console.log("[BUILD EXECUTE] No valid code extracted, raw length:", rawResponse?.length);
      return NextResponse.json(
        { error: "No valid Python code in response" },
        { status: 400 }
      );
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (code.includes(pattern)) {
        return NextResponse.json(
          { error: `Dangerous operation: ${pattern}` },
          { status: 400 }
        );
      }
    }

    const validation = autoFixUE5Code(code);
    let codeWithImports = assetImportCode
      ? combineCodeWithImports(validation.fixedCode, assetImportCode)
      : validation.fixedCode;

    if (userPrompt && typeof userPrompt === "string") {
      try {
        codeWithImports = await enrichCodeWithPolyHavenAssets(codeWithImports, userPrompt, projectId);
      } catch (e) {
        console.warn("[BUILD EXECUTE] Enrich failed:", e);
      }
    }

    const finalCode = CLEANUP_SCRIPT.trim() + "\n\n" + codeWithImports;

    const supabase = createServerClient();

    await supabase.from("chat_turns").insert({
      project_id: projectId,
      agent_name: "Grand Studio",
      agent_title: "Grand Studio",
      content: rawResponse,
      turn_type: "discussion",
    });

    console.log("[BUILD EXECUTE] Saved chat turn; UE command queue disabled (relay removed).");

    return NextResponse.json({
      success: true,
      commandId: null,
      message: "Build saved to chat. Run Python in Unreal with the Grand Studio Commander plugin or paste into the editor — the website no longer queues commands to a local relay.",
      code: finalCode,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[BUILD EXECUTE] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
