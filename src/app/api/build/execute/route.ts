import { NextRequest, NextResponse } from "next/server";
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

function extractPythonCode(rawResponse: string): string {
  const match = rawResponse.match(/```python\n([\s\S]*?)```/);
  const code = match ? match[1].trim() : "";
  return code;
}

export async function POST(request: NextRequest) {
  console.log("[BUILD EXECUTE] Request received");
  try {
    const body = await request.json();
    const { projectId, rawResponse } = body;
    console.log("[BUILD EXECUTE] Body keys:", Object.keys(body), "projectId:", projectId, "rawResponse length:", typeof rawResponse === "string" ? rawResponse.length : 0);

    if (!projectId || typeof rawResponse !== "string") {
      return NextResponse.json(
        { error: "Missing projectId or rawResponse" },
        { status: 400 }
      );
    }

    const code = extractPythonCode(rawResponse);
    if (!code || !code.includes("import unreal")) {
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

    const validation = validateUE5Code(code);
    const finalCode = validation.fixedCode;

    const supabase = createServerClient();

    await supabase.from("chat_turns").insert({
      project_id: projectId,
      agent_name: "Grand Studio",
      agent_title: "Grand Studio",
      content: rawResponse,
      turn_type: "discussion",
    });

    const { data: cmd, error } = await supabase
      .from("ue5_commands")
      .insert({
        project_id: projectId,
        code: finalCode,
        status: "pending",
      })
      .select("id")
      .single();

    console.log("[BUILD EXECUTE] Supabase result:", { id: cmd?.id, error: error?.message });

    if (error || !cmd) {
      const errMsg = error?.message ?? "Failed to queue UE5 command";
      return NextResponse.json(
        { error: errMsg },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      commandId: cmd.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[BUILD EXECUTE] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
