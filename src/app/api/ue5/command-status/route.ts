import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/ue5/command-status?id={uuid}
 * Returns ue5_commands row status for the signed-in user’s project.
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid or missing id" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: cmd, error: cmdErr } = await supabase
      .from("ue5_commands")
      .select("id, status, command_type, error_log, project_id, result")
      .eq("id", id)
      .maybeSingle();

    if (cmdErr || !cmd) {
      return NextResponse.json({ error: "Command not found" }, { status: 404 });
    }

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("user_id")
      .eq("id", cmd.project_id)
      .maybeSingle();

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.user_id != null && project.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let parsedResult: unknown = null;
    const raw = cmd.result;
    if (raw != null && raw !== "") {
      if (typeof raw === "string") {
        try {
          parsedResult = JSON.parse(raw) as unknown;
        } catch {
          parsedResult = { raw };
        }
      } else if (typeof raw === "object") {
        parsedResult = raw;
      }
    }

    return NextResponse.json({
      id: cmd.id,
      status: cmd.status,
      command_type: cmd.command_type ?? null,
      error_log: cmd.error_log ?? null,
      result: parsedResult,
    });
  } catch (e) {
    console.error("[ue5/command-status]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
