/**
 * Unified 3D asset generation: create job, poll status, get result.
 * All providers (Meshy, Grand Forge) go through this layer.
 */

import type { ProviderId, NormalizedGenerationResult, CreateGenerationOptions } from "./providers/base";
import { masterpieceProvider } from "./providers/masterpiece";
import { meshyProvider } from "./providers/meshy";

const PROVIDERS = {
  meshy: meshyProvider,
  masterpiece: masterpieceProvider,
} as const;

function getProvider(provider: ProviderId) {
  const p = PROVIDERS[provider];
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  return p;
}

export type { NormalizedGenerationResult, CreateGenerationOptions };
export { PROVIDERS };

/**
 * Create a generation job for the given provider.
 * Returns provider job id; caller should persist to DB.
 */
export async function createGeneration(
  provider: ProviderId,
  prompt: string,
  options?: CreateGenerationOptions
): Promise<{ jobId: string; raw?: unknown }> {
  const p = getProvider(provider);
  console.log(`[3d/generate] Creating generation. provider=${provider} promptLength=${prompt?.length}`);
  const result = await p.createGeneration(prompt, options);
  console.log(`[3d/generate] Job created. provider=${provider} jobId=${result.jobId}`);
  return result;
}

/**
 * Get current status (for polling).
 */
export async function getGenerationStatus(
  provider: ProviderId,
  jobId: string
): Promise<{ status: string; progress?: number; raw?: unknown }> {
  const p = getProvider(provider);
  const result = await p.getStatus(jobId);
  return {
    status: result.status,
    progress: result.progress,
    raw: result.raw,
  };
}

/**
 * Get full normalized result (status + asset_url, preview_url, etc.).
 */
export async function getGenerationResult(
  provider: ProviderId,
  jobId: string,
  prompt?: string
): Promise<NormalizedGenerationResult | null> {
  const p = getProvider(provider);
  const result = await p.getResult(jobId);
  if (result && prompt) result.prompt = prompt;
  return result;
}
