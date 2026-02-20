import { createServerClient } from "@/lib/supabase/server";
import type { AgentMemory, MemoryType } from "@/lib/agents/types";

export async function saveMemory(
  projectId: string,
  agentName: string,
  memoryType: MemoryType,
  content: string,
  context: string
): Promise<void> {
  const supabase = createServerClient();
  await supabase.from("agent_memory").insert({
    project_id: projectId,
    agent_name: agentName,
    memory_type: memoryType,
    content,
    context,
  });
}

export async function getMemories(
  projectId: string,
  agentName: string,
  limit = 20
): Promise<AgentMemory[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("agent_memory")
    .select("*")
    .eq("project_id", projectId)
    .eq("agent_name", agentName)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AgentMemory[];
}

export async function getTeamMemories(
  projectId: string,
  limit = 30
): Promise<AgentMemory[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("agent_memory")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AgentMemory[];
}

export async function searchMemories(
  projectId: string,
  query: string
): Promise<AgentMemory[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("agent_memory")
    .select("*")
    .eq("project_id", projectId)
    .or(`content.ilike.%${query}%,context.ilike.%${query}%`)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as AgentMemory[];
}

/**
 * Extract memories from an agent response and save them.
 * Looks for decisions, tasks mentioned, and key learnings.
 */
export async function extractAndSaveMemories(
  projectId: string,
  agentName: string,
  response: string,
  bossMessage?: string
): Promise<void> {
  const memories: { type: MemoryType; content: string; context: string }[] = [];

  const decisionPatterns = [
    /(?:I (?:suggest|recommend|propose|think we should|believe))\s+(.{20,200})/gi,
    /(?:we should|let's|the plan is to)\s+(.{20,200})/gi,
  ];

  for (const pattern of decisionPatterns) {
    const matches = response.matchAll(pattern);
    for (const match of matches) {
      memories.push({
        type: "decision",
        content: match[0].trim().slice(0, 300),
        context: bossMessage ? `Boss asked: "${bossMessage.slice(0, 100)}"` : "Team discussion",
      });
      break; // one decision per pattern max
    }
  }

  const codePattern = /```python[\s\S]*?```/g;
  if (codePattern.test(response)) {
    memories.push({
      type: "task",
      content: `${agentName} wrote UE5 Python code in response`,
      context: bossMessage ? `Boss asked: "${bossMessage.slice(0, 100)}"` : "Code task",
    });
  }

  if (response.length > 500) {
    const summary = response.slice(0, 250).replace(/\n/g, " ").trim();
    memories.push({
      type: "learning",
      content: summary,
      context: bossMessage ? `Boss asked: "${bossMessage.slice(0, 100)}"` : "Discussion",
    });
  }

  for (const mem of memories.slice(0, 3)) {
    await saveMemory(projectId, agentName, mem.type, mem.content, mem.context);
  }
}

export function buildMemoryContext(memories: AgentMemory[]): string {
  if (memories.length === 0) return "";

  const grouped: Record<string, string[]> = {};
  for (const m of memories) {
    const key = m.memory_type;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(`- ${m.content} (${m.context})`);
  }

  let ctx = "\n=== YOUR MEMORIES ===\n";
  ctx += "You remember from previous conversations:\n";

  for (const [type, items] of Object.entries(grouped)) {
    ctx += `\n[${type.toUpperCase()}S]\n`;
    ctx += items.slice(0, 5).join("\n") + "\n";
  }

  return ctx;
}
