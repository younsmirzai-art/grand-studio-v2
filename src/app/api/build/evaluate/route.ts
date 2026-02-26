import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { screenshotBase64, originalPrompt, projectId } = body;

    if (!screenshotBase64 || typeof originalPrompt !== "string") {
      return NextResponse.json(
        { error: "Missing screenshotBase64 or originalPrompt" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model =
      process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001";

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY not set" },
        { status: 500 }
      );
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        messages: [
          {
            role: "system",
            content: `You are a UE5 scene quality evaluator. You receive a screenshot of a scene built in Unreal Engine 5.

The user asked for: "${originalPrompt}"

Evaluate the screenshot and respond with:
1. SCORE: 1-10 (how well does it match the user's request?)
2. ISSUES: List specific problems (wrong scale, missing objects, bad lighting, etc.)
3. FIX_CODE: If SCORE < 8, write Python code to fix the issues in a \`\`\`python block. Use the same UE5 Python API (EditorLevelLibrary, load_asset, get_all_level_actors, etc.).

If SCORE >= 8, say "APPROVED" and do not write fix code.
ALWAYS respond with executable Python code for fixes when SCORE < 8, never just descriptions.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Evaluate this UE5 scene. The user asked for: "${originalPrompt}". Score it (1-10) and provide fix code in a \`\`\`python block if score < 8.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${screenshotBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `OpenRouter ${response.status}: ${errText.slice(0, 200)}` },
        { status: response.status }
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const evaluation = data.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
