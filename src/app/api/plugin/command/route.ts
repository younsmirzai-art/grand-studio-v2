import { NextRequest, NextResponse } from "next/server";

const DEFAULT_MODEL = "anthropic/claude-3-5-sonnet-20241022";

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    const last = trimmed.lastIndexOf("}");
    if (last > 0) return trimmed.slice(0, last + 1);
  }
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : null;
}

function formatAssetsForPrompt(assets: unknown, assetCount: unknown): string {
  if (typeof assets === "string") {
    return assets.slice(0, 200_000);
  }
  try {
    return JSON.stringify(assets, null, 0).slice(0, 200_000);
  } catch {
    return String(assets ?? "");
  }
}

function commanderSystemPrompt(assetsText: string): string {
  return `You are Grand Studio AI Commander running inside UE5. You have direct access to the user's project. The user has these assets: ${assetsText}. When the user asks you to build something, respond with a JSON object containing: description (friendly text explaining what you will do) and code (complete Python code to execute in UE5). The Python code must use unreal module. Always use load_asset and spawn_actor_from_object for placing assets. Never use BasicShapes when real assets are available.
Output ONLY valid JSON with keys "description" and "code". No markdown fences, no text before or after the JSON.`;
}

/**
 * POST /api/plugin/command
 * Body: { prompt, assets, assetCount }
 * Returns: { description, code }
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.log("[plugin/command] missing OPENROUTER_API_KEY");
      return NextResponse.json({ error: "OpenRouter not configured" }, { status: 503 });
    }

    const body = (await request.json()) as {
      prompt?: string;
      assets?: unknown;
      assetCount?: unknown;
    };

    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const assetCount = body?.assetCount;
    const assetsText = formatAssetsForPrompt(body?.assets ?? [], assetCount);

    console.log("[plugin/command] received", {
      promptLength: prompt.length,
      assetCount,
      assetsTextLength: assetsText.length,
    });

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const system = commanderSystemPrompt(assetsText);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://grand-studio-v2-prod.vercel.app",
        "X-Title": "Grand Studio AI Commander Plugin",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        temperature: 0.25,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });

    console.log("[plugin/command] OpenRouter status", response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.log("[plugin/command] OpenRouter error body", errText.slice(0, 500));
      return NextResponse.json(
        { error: "AI request failed", detail: errText.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content ?? "";
    console.log("[plugin/command] raw response length", raw.length);

    const jsonStr = extractJsonObject(raw);
    if (!jsonStr) {
      console.log("[plugin/command] could not parse JSON from model output");
      return NextResponse.json(
        { error: "Model did not return valid JSON", raw: raw.slice(0, 2000) },
        { status: 422 },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch (e) {
      console.log("[plugin/command] JSON.parse failed", e);
      return NextResponse.json({ error: "Invalid JSON from model", snippet: jsonStr.slice(0, 500) }, { status: 422 });
    }

    const description = typeof parsed.description === "string" ? parsed.description : "";
    const code = typeof parsed.code === "string" ? parsed.code : "";

    if (!code) {
      console.log("[plugin/command] missing code in parsed payload", Object.keys(parsed));
      return NextResponse.json(
        { error: 'Response must include string "code"', parsed },
        { status: 422 },
      );
    }

    console.log("[plugin/command] success", { descriptionLength: description.length, codeLength: code.length });

    return NextResponse.json({ description, code });
  } catch (e) {
    console.log("[plugin/command] exception", e instanceof Error ? e.message : String(e));
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
