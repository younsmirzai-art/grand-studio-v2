import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/api/auth";

const DANGEROUS = [
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
  const auth = await validateApiKey(request);
  if (!auth.valid) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { projectId, code, agent } = body as {
      projectId?: string;
      code?: string;
      agent?: string;
    };
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
    for (const p of DANGEROUS) {
      if (code.includes(p)) {
        return NextResponse.json(
          { error: `Dangerous operation: ${p}` },
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
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      commandId: data.id,
      status: "queued",
    });
  } catch (error) {
    console.error("[v1/ue5/execute]", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
