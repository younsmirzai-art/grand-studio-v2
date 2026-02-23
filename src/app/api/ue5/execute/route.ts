import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const DANGEROUS_PATTERNS = [
  "os.system",
  "subprocess",
  "eval(",
  "exec(",
  "__import__",
  "shutil.rmtree",
  "shutil.move",
  "os.remove",
  "os.rmdir",
];

export async function POST(request: NextRequest) {
  try {
    const { projectId, code, agentName, submittedByEmail, submittedByName } = await request.json();

    if (!projectId || !code) {
      return NextResponse.json(
        { error: "Missing projectId or code" },
        { status: 400 }
      );
    }

    if (!code.includes("import unreal")) {
      return NextResponse.json(
        { error: 'Code must include "import unreal"' },
        { status: 400 }
      );
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (code.includes(pattern)) {
        return NextResponse.json(
          { error: `Dangerous operation detected: ${pattern}` },
          { status: 400 }
        );
      }
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("ue5_commands")
      .insert({
        project_id: projectId,
        code,
        status: "pending",
        ...(submittedByEmail && { submitted_by_email: submittedByEmail }),
        ...(submittedByName && { submitted_by_name: submittedByName }),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "execution",
      agent_name: agentName ?? "System",
      detail: `Code queued for UE5 execution (${code.length} chars)`,
      ...(submittedByEmail && { user_email: submittedByEmail }),
      ...(submittedByName && { user_name: submittedByName }),
    });

    return NextResponse.json({
      success: true,
      commandId: data.id,
      message:
        "Code queued for UE5 execution. Waiting for local relay to pick it up.",
    });
  } catch (error) {
    console.error("UE5 execute error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
