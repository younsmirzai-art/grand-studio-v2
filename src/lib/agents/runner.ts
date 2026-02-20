import type { AgentIdentity, AgentName, ChatMessage } from "./types";
import { buildSystemPrompt } from "./prompts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey(): string {
  return process.env.OPENROUTER_API_KEY ?? "";
}

async function callOpenRouter(
  model: string,
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://grand-studio-v2.vercel.app",
      "X-Title": "Grand Studio v2",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function callAgent(
  agent: AgentIdentity,
  messages: ChatMessage[],
  projectContext: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(agent, projectContext);
  const apiKey = getApiKey();
  return callOpenRouter(agent.model, apiKey, systemPrompt, messages, agent.maxTokens);
}

export async function callAgentRaw(
  _agentName: AgentName,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const apiKey = getApiKey();
  return callOpenRouter(model, apiKey, systemPrompt, messages, maxTokens);
}
