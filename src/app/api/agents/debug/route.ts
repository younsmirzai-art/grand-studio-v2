import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { quickFix } from "@/lib/agents/errorPatterns";
import { debugAndRetry } from "@/lib/agents/autoDebug";
import { buildProjectContext, sendToUE5AndWait } from "@/lib/agents/projectMode";

/**
 * POST /api/agents/debug
 * Body: { projectId, code, error, agentName }
 * When Debug Mode is on: try quickFix, then Morgan debugAndRetry.
 * Returns { ok, fixed?: "quick" | "morgan", skipped?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, code, error: errorMessage, agentName } = body as {
      projectId?: string;
      code?: string;
      error?: string;
      agentName?: string;
    };

    if (!projectId || !code || !errorMessage || !agentName) {
      return NextResponse.json(
        { error: "Missing projectId, code, error, or agentName" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data: settings } = await supabase
      .from("project_settings")
      .select("debug_mode_auto")
      .eq("project_id", projectId)
      .single();

    if (settings?.debug_mode_auto === false) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const fixedByQuick = quickFix(code, errorMessage);
    if (fixedByQuick) {
      const r = await sendToUE5AndWait(projectId, fixedByQuick, agentName);
      if (r.success) {
        await supabase.from("chat_turns").insert({
          project_id: projectId,
          agent_name: "System",
          agent_title: "System",
          content: "🔧 Auto-fixed common error pattern and re-executed successfully.",
          turn_type: "discussion",
        });
        return NextResponse.json({ ok: true, fixed: "quick" });
      }
    }

    const projectContext = await buildProjectContext(projectId);
    const success = await debugAndRetry(
      { projectId, code, error: errorMessage, agentName },
      projectContext,
      async (pid, c, agent) => {
        const res = await sendToUE5AndWait(pid, c, agent);
        return { success: res.success, error: res.error };
      },
      3
    );

    return NextResponse.json({ ok: success, fixed: success ? "morgan" : undefined });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
