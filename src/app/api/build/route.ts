import { NextRequest, NextResponse } from "next/server";
import { askGrandStudioAI } from "@/lib/ai/grandStudioAI";
import { autoFixUE5Code } from "@/lib/ue5/autoFixer";
import { createServerClient } from "@/lib/supabase/server";

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

export async function POST(request: NextRequest) {
  try {
    const { projectId, prompt, projectContext } = await request.json();

    if (!projectId || !prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing projectId or prompt" },
        { status: 400 }
      );
    }

    const trimmed = prompt.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Prompt is empty" }, { status: 400 });
    }

    const aiResponse = await askGrandStudioAI(trimmed, projectContext ?? undefined);

    if (!aiResponse.code || !aiResponse.code.includes("import unreal")) {
      return NextResponse.json(
        { error: "AI did not generate valid UE5 Python code", raw: aiResponse.rawResponse?.slice(0, 500) },
        { status: 400 }
      );
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (aiResponse.code.includes(pattern)) {
        return NextResponse.json(
          { error: `Dangerous operation detected: ${pattern}` },
          { status: 400 }
        );
      }
    }

    const validation = autoFixUE5Code(aiResponse.code);
    const finalCode = validation.fixedCode;

    const supabase = createServerClient();

    await supabase.from("chat_turns").insert({
      project_id: projectId,
      agent_name: "Grand Studio",
      agent_title: "Grand Studio",
      content: aiResponse.rawResponse,
      turn_type: "discussion",
    });

    return NextResponse.json({
      success: true,
      description: aiResponse.description,
      code: finalCode,
      executionResult: null,
      commandId: null,
      message: "Code generated and logged. Remote UE execution via relay is disabled — use the Commander plugin to run in-editor.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/build] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
