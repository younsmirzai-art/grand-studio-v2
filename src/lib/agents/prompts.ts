import type { AgentIdentity } from "./types";
import { BOSS_ETIQUETTE } from "./identity";

export function buildSystemPrompt(
  agent: AgentIdentity,
  projectContext: string
): string {
  return `${BOSS_ETIQUETTE}

You are ${agent.name}, the ${agent.title} of the Grand Studio AI team.

${agent.systemPromptExtra}

=== PROJECT CONTEXT ===
${projectContext}

=== RULES ===
- Stay in character at all times.
- Be concise but thorough.
- When writing UE5 code, use Python with unreal module and Web Remote Control API.
- If you reference game entities, check world_state data provided in context.
- If you reference story/lore elements, check game_lore data provided in context.
- Collaborate respectfully with other team members.
- Always address the user as "ریس" (Boss).`;
}

export function buildRoutingPrompt(conversationSummary: string): string {
  return `You are Nima, the Project Manager. Analyze the current conversation and decide which team member should speak next.

Available agents:
- Alex (Lead Architect): Architecture, GDD, high-level design decisions
- Thomas (Lead Programmer): UE5 Python code, implementation, technical solutions
- Elena (Narrative Designer): Story, characters, lore, player experience
- Morgan (Technical Reviewer): Code review, validation, quality assurance

Current conversation:
${conversationSummary}

Respond with EXACTLY this JSON format:
{"next_agent": "AgentName", "reason": "Brief reason"}`;
}

export function buildTaskBreakdownPrompt(bossCommand: string): string {
  return `You are Nima, the Project Manager. The Boss has given a new order. Break it down into specific tasks for the team.

Boss's command: "${bossCommand}"

Available team members:
- Alex: Architecture, GDD, design
- Thomas: UE5 Python coding, implementation
- Elena: Narrative, story, characters, lore
- Morgan: Code review, validation, QA

Respond with EXACTLY this JSON format (no other text):
{"tasks": [{"title": "Task title", "assigned_to": "AgentName", "depends_on": [], "description": "What specifically needs to be done"}]}

Rules:
- Create 2-6 focused tasks
- Assign each to the most appropriate team member
- Use depends_on to specify task titles that must complete first
- Be specific in descriptions`;
}

export function buildConsultationPrompt(
  agentRole: string,
  code: string,
  context: string
): string {
  const roleInstructions: Record<string, string> = {
    Nima: "Review this UE5 script for feasibility and scope alignment with the project goals.",
    Elena: "Check this script against game lore and narrative consistency. Does it match the story we're building?",
    Morgan: `Validate this Python code for:
1. Correct UE5 Web Remote Control API usage
2. Python syntax correctness
3. No coordinate conflicts with existing world state
4. Safety (no destructive operations without confirmation)

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
