import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { projectId, characterName, dialogue, voiceType, scene } = await request.json();

    if (!projectId || !characterName || !dialogue) {
      return NextResponse.json(
        { error: "projectId, characterName, and dialogue are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("voice_lines")
      .insert({
        project_id: projectId,
        character_name: characterName.trim(),
        dialogue: dialogue.trim(),
        voice_type: voiceType || "male",
        scene: scene?.trim() || null,
        created_by: "boss",
      })
      .select()
      .single();

    if (error) {
      console.error("[voice] Insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[voice] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 }
    );
  }
}
