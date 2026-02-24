import { NextRequest, NextResponse } from "next/server";
import { askGrandStudioAI } from "@/lib/ai/grandStudioAI";
import { validateUE5Code } from "@/lib/ue5/codeValidator";
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

    const validation = validateUE5Code(aiResponse.code);
    const finalCode = validation.fixedCode;

    const supabase = createServerClient();

    await supabase.from("chat_turns").insert({
      project_id: projectId,
      agent_name: "Grand Studio AI",
      agent_title: "Grand Studio AI",
      content: aiResponse.rawResponse,
      turn_type: "discussion",
    });

    const { data: cmd, error: insertError } = await supabase
      .from("ue5_commands")
      .insert({
        project_id: projectId,
        code: finalCode,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !cmd) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to queue UE5 command" },
        { status: 500 }
      );
    }

    const commandId = cmd.id as string;

    let result: { status: string; result?: string; error_log?: string } | null = null;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const { data } = await supabase
        .from("ue5_commands")
        .select("status, result, error_log")
        .eq("id", commandId)
        .single();

      if (data?.status === "success" || data?.status === "error") {
        result = data as { status: string; result?: string; error_log?: string };
        break;
      }
    }

    return NextResponse.json({
      success: result?.status === "success",
      description: aiResponse.description,
      code: finalCode,
      executionResult: result,
      commandId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/build] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
