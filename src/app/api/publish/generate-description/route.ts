import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { callAgent } from "@/lib/agents/runner";
import { getAgent } from "@/lib/agents/identity";
import type { ChatMessage } from "@/lib/agents/types";

/**
 * Ask Elena to write a Steam store description based on project lore and brief.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId" },
        { status: 400 }
      );
    }

    const elena = getAgent("Elena");
    if (!elena) {
      return NextResponse.json(
        { error: "Elena agent not configured" },
        { status: 500 }
      );
    }

    const supabase = createServerClient();
    const [projectRes, loreRes] = await Promise.all([
      supabase.from("projects").select("name, initial_prompt").eq("id", projectId).single(),
      supabase.from("game_lore").select("category, key, value").eq("project_id", projectId),
    ]);

    const project = projectRes.data as { name?: string; initial_prompt?: string } | null;
    const lore = (loreRes.data ?? []) as { category: string; key: string; value: string }[];

    let context = `Project name: ${project?.name ?? "Untitled"}\n`;
    context += `Game concept / brief: ${project?.initial_prompt ?? "—"}\n\n`;
    if (lore.length > 0) {
      context += "--- GAME LORE ---\n";
      for (const l of lore) {
        context += `[${l.category}] ${l.key}: ${l.value}\n`;
      }
    }

    const prompt = `You are writing the LONG description for a Steam store page. Based on the project and lore below, write a compelling store description (2–4 paragraphs) that:
- Highlights the game's premise, world, and key features
- Uses clear, marketing-friendly language
- Mentions story, atmosphere, and what makes the game unique
- Is suitable for Steam's store (no placeholder text)
Output ONLY the store description text, no preamble.`;

    const messages: ChatMessage[] = [
      { role: "user", content: `${prompt}\n\n---\n\n${context}` },
    ];

    const response = await callAgent(elena, messages, context);

    return NextResponse.json({
      success: true,
      long_description: response.trim(),
    });
  } catch (error) {
    console.error("[publish/generate-description]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generate failed" },
      { status: 500 }
    );
  }
}
