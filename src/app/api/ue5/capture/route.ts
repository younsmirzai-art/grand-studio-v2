import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** Minimal UE5 Python that only takes a viewport screenshot. Relay executes this and captures. */
const CAPTURE_ONLY_CODE = `import unreal
import os
path = "C:/GrandStudio/Screenshots"
os.makedirs(path, exist_ok=True)
from datetime import datetime
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
filename = f"{path}/capture_{ts}.png"
try:
    unreal.AutomationLibrary.take_high_res_screenshot(1920, 1080, filename)
    print(f"SCREENSHOT_PATH:{filename}")
except Exception as e:
    print(f"SCREENSHOT_ERROR:{e}")
`;

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("ue5_commands")
      .insert({
        project_id: projectId,
        code: CAPTURE_ONLY_CODE,
        status: "pending",
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
      agent_name: "Boss",
      detail: "📸 Capture Now: Screenshot requested",
    });

    return NextResponse.json({
      success: true,
      commandId: data.id,
      message: "Screenshot requested. Relay will capture and upload when ready.",
    });
  } catch (error) {
    console.error("UE5 capture error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
