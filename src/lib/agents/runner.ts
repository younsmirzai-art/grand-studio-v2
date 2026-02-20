import type { AgentIdentity, AgentName, ChatMessage } from "./types";
import { buildSystemPrompt } from "./prompts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function getApiKeyForAgent(agentName: string): string {
  const keyMap: Record<string, string | undefined> = {
    Nima: process.env.OPENROUTER_GEMINI_API_KEY ?? process.env.OPENROUTER_API_KEY,
    Alex: process.env.OPENROUTER_ANTHROPIC_API_KEY ?? process.env.OPENROUTER_API_KEY,
    Thomas: process.env.OPENROUTER_DEEPSEEK_API_KEY ?? process.env.OPENROUTER_API_KEY,
    Elena: process.env.OPENROUTER_CHATGPT_API_KEY ?? process.env.OPENROUTER_API_KEY,
    Morgan: process.env.OPENROUTER_GEMINI_API_KEY ?? process.env.OPENROUTER_API_KEY,
  };
  return keyMap[agentName] ?? process.env.OPENROUTER_API_KEY ?? "";
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
  const apiKey = getApiKeyForAgent(agent.name);

  try {
    return await callOpenRouter(agent.model, apiKey, systemPrompt, messages, agent.maxTokens);
  } catch (primaryError) {
    console.error(`Primary call failed for ${agent.name}:`, primaryError);

    const fallbackKey = process.env.OPENROUTER_API_KEY ?? "";
    if (fallbackKey && fallbackKey !== apiKey) {
      return await callOpenRouter(agent.model, fallbackKey, systemPrompt, messages, agent.maxTokens);
    }
    throw primaryError;
  }
}

export async function callAgentRaw(
  agentName: AgentName,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const apiKey = getApiKeyForAgent(agentName);
  return callOpenRouter(model, apiKey, systemPrompt, messages, maxTokens);
}
