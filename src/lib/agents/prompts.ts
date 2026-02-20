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
10. All code goes through Consultation Loop before execution
11. Code is sent to UE5 via HTTP at localhost:30010
`;
}

export function buildRoutingPrompt(conversationSummary: string): string {
  return `You are Nima, the Project Manager. Analyze the current conversation and decide which team member should speak next.

Available agents:
- Alex (Lead Architect): Architecture, GDD, high-level design decisions, plugin selection
- Thomas (Lead Programmer): UE5 Python code, implementation using active plugins (PCG, Landmass, EQS, etc.)
- Elena (Narrative Designer): Story, characters, lore, player experience, mood/weather requests
- Morgan (Technical Reviewer): Code review, validation, quality assurance, plugin compatibility checks

Current conversation:
${conversationSummary}

Respond with EXACTLY this JSON format:
{"next_agent": "AgentName", "reason": "Brief reason"}`;
}

export function buildTaskBreakdownPrompt(bossCommand: string): string {
  return `You are Nima, the Project Manager. The Boss has given a new order. Break it down into specific tasks for the team.

Boss's command: "${bossCommand}"

Available team members and their UE5 capabilities:
- Alex: Architecture, GDD, design — picks which plugins to use (PCG, World Partition, Landmass, Mass Entity, etc.)
- Thomas: UE5 Python coding via localhost:30010 — writes executable code using active plugins
- Elena: Narrative, story, characters, lore — suggests mood/weather/NPC behavior for story beats
- Morgan: Code review, validation, QA — validates code against active plugins and world_state

Available UE5 plugins: PCG, Landmass+Water, World Partition, Megascans, Ultra Dynamic Sky, EQS, State Tree, Smart Objects, Mass Entity, Geometry Script, Modeling Tools, Datasmith, Movie Pipeline, Editor Scripting Utilities.

Respond with EXACTLY this JSON format (no other text):
{"tasks": [{"title": "Task title", "assigned_to": "AgentName", "depends_on": [], "description": "What specifically needs to be done"}]}

Rules:
- Create 2-6 focused tasks
- Assign each to the most appropriate team member
- Use depends_on to specify task titles that must complete first
- Be specific in descriptions — mention which UE5 plugin/system should be used`;
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
