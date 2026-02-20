import { createServerClient } from "@/lib/supabase/server";
import { callAgent } from "./runner";
import { getAgent } from "./identity";
import type { ChatMessage, AgentName } from "./types";

async function logGodEye(
  projectId: string,
  eventType: string,
  agentName: string,
  detail: string
) {
  const supabase = createServerClient();
  await supabase.from("god_eye_log").insert({
    project_id: projectId,
    event_type: eventType,
    agent_name: agentName,
    detail,
  });
}

async function saveChatTurn(
  projectId: string,
  agentName: string,
  agentTitle: string,
  content: string,
  turnType: string,
) {
  const supabase = createServerClient();
  await supabase.from("chat_turns").insert({
    project_id: projectId,
    agent_name: agentName,
    agent_title: agentTitle,
    content,
    turn_type: turnType,
  });
}

const CONSULTATION_RULES: Record<string, AgentName[]> = {
  Thomas: ["Morgan"],
  Alex: ["Nima"],
  Elena: ["Alex"],
};

function getConsultants(requestingAgent: AgentName, topic: string): AgentName[] {
  const defaults = CONSULTATION_RULES[requestingAgent] ?? [];

  if (/code|script|python|blueprint/i.test(topic)) {
    if (!defaults.includes("Morgan")) defaults.push("Morgan");
    if (!defaults.includes("Thomas")) defaults.push("Thomas");
  }
  if (/architect|design|system|structure/i.test(topic)) {
    if (!defaults.includes("Alex")) defaults.push("Alex");
  }
  if (/story|lore|character|narrative/i.test(topic)) {
    if (!defaults.includes("Elena")) defaults.push("Elena");
  }

  return defaults.filter((n) => n !== requestingAgent).slice(0, 3);
}

export async function startConsultation(
  projectId: string,
  requestingAgent: AgentName,
  topic: string,
  details: string,
  projectContext: string
): Promise<string[]> {
  const consultants = getConsultants(requestingAgent, topic);

  if (consultants.length === 0) return [];

  const requestor = getAgent(requestingAgent)!;
  await saveChatTurn(
    projectId,
    requestor.name,
    requestor.title,
    `🤝 **Consultation Request**: ${topic}\n\n${details.slice(0, 500)}`,
    "consultation"
  );
  await logGodEye(projectId, "thinking", requestor.name, `Requesting consultation on: ${topic}`);

  const responses: string[] = [];

  for (const consultantName of consultants) {
    const consultant = getAgent(consultantName);
    if (!consultant) continue;

    const consultPrompt = `${requestor.name} is requesting your consultation on: "${topic}"

Details:
${details.slice(0, 1000)}

As ${consultant.name} (${consultant.title}), provide your expert input.
Be concise and constructive. If you see issues, explain what should change.
If it looks good, say so and add any suggestions.`;

    await logGodEye(projectId, "api_call", consultant.name, `Consulting on: ${topic}`);

    try {
      const messages: ChatMessage[] = [
        { role: "user", content: consultPrompt },
      ];
      const response = await callAgent(consultant, messages, projectContext);

      await saveChatTurn(
        projectId,
        consultant.name,
        consultant.title,
        `🤝 **Consultation Response** (re: ${requestor.name}'s request):\n\n${response}`,
        "consultation"
      );
      await logGodEye(projectId, "api_ok", consultant.name, `Consultation response (${response.length} chars)`);
      responses.push(`${consultant.name}: ${response}`);
    } catch (err) {
      await logGodEye(projectId, "error", consultant.name, `Consultation failed: ${String(err)}`);
    }
  }

  return responses;
}

/**
 * Check if a response warrants automatic consultation.
 * Returns true if the response contains code, architecture decisions, or narrative choices.
 */
export function shouldAutoConsult(agentName: AgentName, response: string): { should: boolean; topic: string } {
  if (agentName === "Thomas" && /```python/i.test(response)) {
    return { should: true, topic: "UE5 code review" };
  }
  if (agentName === "Alex" && /(?:architecture|design pattern|system design|component structure)/i.test(response)) {
    return { should: true, topic: "Architecture decision" };
  }
  if (agentName === "Elena" && /(?:plot twist|major event|character death|world-changing)/i.test(response)) {
    return { should: true, topic: "Major narrative decision" };
  }
  return { should: false, topic: "" };
}
