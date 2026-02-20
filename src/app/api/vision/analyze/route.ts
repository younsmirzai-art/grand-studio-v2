import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { projectId, imageBase64 } = await request.json();

    if (!projectId || !imageBase64) {
      return NextResponse.json(
        { error: "Missing projectId or imageBase64" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "api_call",
      agent_name: "Vision",
      detail: "Analyzing screenshot with GPT-4o Vision",
    });

    const visionKey = process.env.OPENROUTER_CHATGPT_API_KEY ?? process.env.OPENROUTER_API_KEY;
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${visionKey}`,
        "HTTP-Referer": "https://grand-studio-v2.vercel.app",
        "X-Title": "Grand Studio v2",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this UE5 screenshot. Describe what you see: the scene layout, assets, lighting, any issues or suggestions for improvement. Be specific about positions and what could be added or changed.",
              },
              {
                type: "image_url",
                image_url: { url: imageBase64 },
              },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Vision API error: ${err}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content ?? "No analysis available";

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "api_ok",
      agent_name: "Vision",
      detail: `Analysis complete (${analysis.length} chars)`,
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Vision analysis error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
