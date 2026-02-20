import type { AgentIdentity } from "./types";
import { BOSS_ETIQUETTE } from "./identity";
import { buildUE5CapabilitiesContext } from "../ue5/plugin-registry";

export function buildSystemPrompt(
  agent: AgentIdentity,
  projectContext: string
): string {
  const ue5Context = buildUE5CapabilitiesContext();

  return `${BOSS_ETIQUETTE}

You are ${agent.name}, ${agent.title} of Grand Studio — an AI game development team.
The Boss (ریس) is the manager who decides everything. You are a team member who discusses, suggests, and executes when asked.

${agent.systemPromptExtra}

=== PROJECT CONTEXT ===
${projectContext}

${ue5Context}

=== RULES FOR UE5 CODE ===
1. All code MUST start with "import unreal"
2. Use ONLY UE5 Python API — no pip packages, no external dependencies
3. Before spawning anything, check world_state to avoid duplicates
4. Use the available plugins listed above — they are ALL active and ready
5. For large-scale content, prefer PCG rules over manual placement
6. For terrain, use Landmass plugin APIs
7. For weather/sky, use Ultra Dynamic Sky APIs
8. For NPC behavior, use State Tree + EQS + Smart Objects
9. For large battles, use Mass Entity
10. Code is sent to UE5 via HTTP at localhost:30010

=== CONSULTATION ===
When you're about to make a major decision (architecture, code, narrative), other team members may consult with you.
Be collaborative. Your memories of past decisions help avoid repeating mistakes.
`;
}

export function buildRoutingPrompt(conversationSummary: string): string {
  return `Analyze the current conversation and summarize what the team should discuss next.

Current conversation:
${conversationSummary}

What topic or question should the team address next?`;
}

export function buildTaskBreakdownPrompt(bossCommand: string): string {
  return `The Boss said: "${bossCommand}"

Share your thoughts on this request. What do you think the team should do? What's your area of expertise that could help here?

Do NOT create task lists or assign work — the Boss will do that. Just discuss your ideas.`;
}

export function buildConsultationPrompt(
  agentRole: string,
  code: string,
  context: string
): string {
  const roleInstructions: Record<string, string> = {
    Nima: "Review this UE5 script for feasibility and scope alignment with the project goals. Verify it uses the right plugins for the job.",
    Elena: "Check this script against game lore and narrative consistency. Does it match the story we're building? Does the mood/atmosphere fit?",
    Morgan: `Validate this Python code for:
1. Targets correct server: PUT http://localhost:30010/remote/object/call
2. Uses only active plugins: PCG, Landmass, Water, World Partition, Megascans, EQS, State Tree, Smart Objects, Mass Entity, Geometry Script, Modeling Tools, Datasmith, Movie Pipeline, Ultra Dynamic Sky, Editor Scripting Utilities
3. All imports are UE5-native (no pip packages)
4. No dangerous operations (os.system, subprocess, eval, exec, __import__, shutil.rmtree)
5. world_state checked before spawning
6. PCG used instead of manual placement for large-scale content
7. Code is self-contained and complete

If the code has issues, respond with "REJECTED:" followed by the issues.
If the code is acceptable, respond with "APPROVED:" followed by any notes.`,
  };

  return `${roleInstructions[agentRole] ?? "Review this code."}

=== UE5 CODE ===
\`\`\`python
${code}
\`\`\`

=== CONTEXT ===
${context}`;
}
