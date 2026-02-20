import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAgent } from "@/lib/agents/identity";
import type { AgentName } from "@/lib/agents/types";

const VISION_MODEL = "openai/gpt-4o";

export async function POST(request: NextRequest) {
  try {
    const {
      projectId,
      agentName,
      screenshotUrl,
      originalCode,
      executionResult,
    } = await request.json();

    if (!projectId || !screenshotUrl) {
      return NextResponse.json(
        { error: "Missing projectId or screenshotUrl" },
        { status: 400 }
      );
    }

    const agent = agentName ? getAgent(agentName as AgentName) : null;
    const reviewer = agent?.name ?? "Morgan";

    const supabase = createServerClient();

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "api_call",
      agent_name: reviewer,
      detail: "📸 Visual review: Analyzing UE5 screenshot",
    });

    const systemPrompt = `You are ${reviewer}, reviewing UE5 code execution results for Grand Studio.
You have access to a screenshot of the UE5 viewport after code was executed.
Analyze the screenshot carefully:
1. Did the code produce the expected visual result?
2. Are there any visual errors or problems you can see?
3. What needs to be fixed or improved?
4. If something is wrong, write corrected Python code in a \`\`\`python block.
Be specific about what you see in the screenshot. Use UE5 Python API only.`;

    const userContent = [
      {
        type: "text" as const,
        text: `You just executed this code in UE5:

\`\`\`python
${originalCode ?? "N/A"}
\`\`\`

Execution result: ${executionResult ?? "Success"}

Here is a screenshot of what UE5 looks like now. Analyze it and provide feedback. If something needs fixing, write corrected code.`,
      },
      {
        type: "image_url" as const,
        image_url: { url: screenshotUrl },
      },
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://grand-studio-v2.vercel.app",
        "X-Title": "Grand Studio v2",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Vision API error: ${err}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content ?? "No analysis available";

    await supabase.from("chat_turns").insert({
      project_id: projectId,
      agent_name: reviewer,
      agent_title: agent?.title ?? "Reviewer",
      content: analysis,
      turn_type: "critique",
      screenshot_url: screenshotUrl,
    });

    await supabase.from("god_eye_log").insert({
      project_id: projectId,
      event_type: "api_ok",
      agent_name: reviewer,
      detail: `📸 Visual review complete (${analysis.length} chars)`,
    });

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[/api/agents/visual-review] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
