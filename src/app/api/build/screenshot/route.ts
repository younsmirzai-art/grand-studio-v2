import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const SCREENSHOT_CODE = `
import unreal
import datetime
import os

os.makedirs(r'C:\\\\building_games\\\\screenshots', exist_ok=True)
timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
filepath = os.path.join(r'C:\\\\building_games\\\\screenshots', f'build_{timestamp}.png')

try:
    unreal.AutomationUtilsBlueprintLibrary.take_high_res_screenshot(1920, 1080, filepath)
    unreal.log(f'SCREENSHOT_SAVED:{filepath}')
except Exception as e:
    unreal.log_error(str(e))
`.trim();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: cmd, error } = await supabase
      .from("ue5_commands")
      .insert({
        project_id: projectId,
        code: SCREENSHOT_CODE,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !cmd) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to queue screenshot" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, commandId: cmd.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
