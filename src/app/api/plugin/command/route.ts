import { NextRequest, NextResponse } from "next/server";

const DEFAULT_MODEL = "anthropic/claude-3-5-sonnet-20241022";

/** Slice from first `{` through end of text (may be incomplete). */
function extractJsonCandidate(text: string): string | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  if (start < 0) return null;
  return trimmed.slice(start);
}

/**
 * Best-effort repair: close an open string, then `]`, then `}` to balance JSON structure.
 * Brace/bracket counts ignore characters inside quoted strings.
 */
function repairIncompleteJson(input: string): string {
  let s = input;
  let depth = 0;
  let bdepth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === "[") bdepth++;
    else if (c === "]") bdepth--;
  }
  let out = s;
  if (inString) out += '"';
  while (bdepth > 0) {
    out += "]";
    bdepth--;
  }
  while (depth > 0) {
    out += "}";
    depth--;
  }
  return out;
}

function tryParsePluginJson(text: string): Record<string, unknown> | null {
  const candidate = extractJsonCandidate(text);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(repairIncompleteJson(candidate)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

/** First ```python or ``` fenced block in the raw response. */
function extractPythonFromFences(text: string): string | null {
  const re = /```(?:python)?\s*([\s\S]*?)```/;
  const m = text.match(re);
  if (!m?.[1]) return null;
  const body = m[1].trim();
  return body || null;
}

function formatAssetsForPrompt(assets: unknown): string {
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
  return `Grand Studio AI Commander in UE5. Available assets: ${assetsText}

For build requests reply with ONLY a JSON object (no markdown, no text outside JSON):
{"description":"short friendly plan","code":"..."}

Rules:
- Python: import unreal, use EditorAssetLibrary.load_asset and EditorLevelLibrary.spawn_actor_from_object for meshes. No BasicShapes if an asset path fits the request.
- Keep code ≤50 lines, minimal and focused. End with unreal.log(...).
- Escape double quotes inside the code string as \\".`;
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
    const assetsText = formatAssetsForPrompt(body?.assets ?? []);

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
        max_tokens: 16000,
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

    let parsed = tryParsePluginJson(raw);
    if (parsed) {
      console.log("[plugin/command] JSON parse ok (raw or after repair)");
    } else {
      console.log("[plugin/command] JSON parse failed after repair, will try fenced code");
    }

    let description = typeof parsed?.description === "string" ? parsed.description : "";
    let code = typeof parsed?.code === "string" ? parsed.code : "";

    if (!code) {
      const fenced = extractPythonFromFences(raw);
      if (fenced) {
        code = fenced;
        if (!description) description = "Recovered Python from markdown code fence in model output.";
        console.log("[plugin/command] using fallback fenced code", { codeLength: code.length });
      }
    }

    if (!code) {
      console.log("[plugin/command] no code from JSON or fences");
      return NextResponse.json(
        { error: "Model did not return usable JSON or fenced Python", raw: raw.slice(0, 2000) },
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
