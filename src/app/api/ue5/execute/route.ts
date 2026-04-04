import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { autoFixUE5Code } from "@/lib/ue5/autoFixer";
import { rateLimitExecute } from "@/lib/api/rateLimit";
import { queueUE5Command, type ImportContext } from "@/lib/ue5/commands";

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

const ALLOWED_COMMAND_TYPES = new Set([
  "import",
  "scan_assets",
  "screenshot",
  "capture",
  "execute",
]);

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const rl = await rateLimitExecute(ip);
    if (rl.limited) return rl.response!;

    const {
      projectId,
      code,
      agentName,
      submittedByEmail,
      submittedByName,
      commandType,
      importContext,
    } = await request.json();

    console.log(
      "[ue5/execute] POST",
      "projectId=",
      projectId ?? "(missing)",
      "codeLen=",
      code?.length ?? 0,
      "commandType=",
      commandType ?? "(none)"
    );

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
        console.warn("[ue5/execute] Blocked dangerous pattern:", pattern);
        return NextResponse.json(
          { error: `Dangerous operation detected: ${pattern}` },
          { status: 400 }
        );
      }
    }

    let codeToRun = code;
    const validation = autoFixUE5Code(code);
    if (validation.errors.length > 0) {
      console.log("[ue5/execute] Code auto-fixed:", validation.errors);
      codeToRun = validation.fixedCode;
    }

    const queueOpts: {
      commandType?: "import" | "scan_assets" | "screenshot" | "capture" | "execute";
      importContext?: ImportContext;
    } = {};
    if (commandType && ALLOWED_COMMAND_TYPES.has(String(commandType))) {
      queueOpts.commandType = commandType as typeof queueOpts.commandType;
    }
    if (importContext && typeof importContext === "object") {
      queueOpts.importContext = importContext as ImportContext;
    }

    const commandId = await queueUE5Command(projectId, codeToRun, queueOpts);

    const supabase = createServerClient();
    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "execution",
      agent_name: agentName ?? "System",
      detail: `Code queued for UE5 execution (${codeToRun.length} chars)`,
      ...(submittedByEmail && { user_email: submittedByEmail }),
      ...(submittedByName && { user_name: submittedByName }),
    });

    return NextResponse.json({
      success: true,
      commandId,
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
