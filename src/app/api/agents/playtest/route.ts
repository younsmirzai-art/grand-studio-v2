import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { runPlaytest, formatReportAsMessage } from "@/lib/agents/playtester";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, screenshotUrl, focusArea } = body as {
      projectId?: string;
      screenshotUrl?: string;
      focusArea?: "visual" | "gameplay" | "performance" | "design" | "all";
    };

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const report = await runPlaytest({
      projectId,
      screenshotUrl: screenshotUrl ?? undefined,
      focusArea: focusArea ?? "all",
    });

    const supabase = createServerClient();
    const message = formatReportAsMessage(report);
    await supabase.from("chat_turns").insert({
      project_id: projectId,
      agent_name: "Amir",
      agent_title: "Playtester",
      content: message + (report.rawResponse ? "\n\n---\n\n" + report.rawResponse.slice(0, 2000) : ""),
      turn_type: "critique",
      screenshot_url: report.screenshotUrl ?? null,
    });

    await supabase.from("playtest_reports").insert({
      project_id: projectId,
      score: report.score,
      critical_count: report.criticalIssues.length,
      warning_count: report.warnings.length,
      minor_count: report.minorIssues.length,
      report_json: report as unknown as Record<string, unknown>,
      screenshot_url: report.screenshotUrl ?? null,
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Playtest API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Playtest failed" },
      { status: 500 }
    );
  }
}
