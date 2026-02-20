import { createServerClient } from "@/lib/supabase/server";

const SKETCHFAB_REGEX = /\[SKETCHFAB:\s*([^\]]+)\]/gi;

export function extractSketchfabQueries(text: string): string[] {
  const matches = [...text.matchAll(SKETCHFAB_REGEX)];
  const queries = matches.map((m) => m[1].trim()).filter(Boolean);
  return [...new Set(queries)];
}

export async function runSketchfabSearchAndPost(
  projectId: string,
  query: string
): Promise<void> {
  try {
    const url = `https://api.sketchfab.com/v3/search?type=models&q=${encodeURIComponent(query)}&downloadable=true&count=8`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return;

    const data = await res.json();
    const results = (data.results ?? []).slice(0, 5).map((m: { name: string; user: { displayName: string }; uid: string }) => ({
      name: m.name,
      author: m.user?.displayName ?? "Unknown",
      url: `https://sketchfab.com/3d-models/${m.uid}`,
    })) as { name: string; author: string; url: string }[];

    if (results.length === 0) return;

    const lines = results.map((r: { name: string; author: string; url: string }) => `- **${r.name}** by ${r.author}: ${r.url}`);
    const message = `[SKETCHFAB Results for "${query}"]\n\n${lines.join("\n")}\n\nConsider importing these into UE5.`;

    const supabase = createServerClient();
    await supabase.from("chat_turns").insert({
      project_id: projectId,
      agent_name: "System",
      agent_title: "Tool",
      content: message,
      turn_type: "discussion",
    });
  } catch (err) {
    console.error("[sketchfab-trigger] Error:", err);
  }
}

export async function triggerSketchfabFromResponse(
  projectId: string,
  response: string
): Promise<void> {
  const queries = extractSketchfabQueries(response);
  for (const q of queries.slice(0, 1)) {
    await runSketchfabSearchAndPost(projectId, q);
  }
}
