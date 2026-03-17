/**
 * Shared types and interface for 3D generation providers.
 * All providers (Meshy, Grand Forge, etc.) normalize to this shape.
 */

export type ProviderId = "meshy" | "masterpiece";

/** Display names: never expose third-party product names; use our own. */
export const PROVIDER_DISPLAY_NAMES: Record<ProviderId, string> = {
  meshy: "Meshy",
  masterpiece: "Grand Forge",
};

export type GenerationStatus =
  | "pending"
  | "processing"
  | "in_progress"
  | "complete"
  | "completed"
  | "SUCCEEDED"
  | "failed"
  | "FAILED";

/** Normalized result from any provider after generation completes. */
export interface NormalizedGenerationResult {
  provider: ProviderId;
  provider_job_id: string;
  status: GenerationStatus;
  prompt: string;
  preview_url: string | null;
  asset_url: string | null;
  file_type: string;
  raw_response: unknown;
  error_message: string | null;
  /** Optional progress 0-100 during processing */
  progress?: number;
}

/** Options when creating a generation (text-to-3d). Prompt is passed separately. */
export interface CreateGenerationOptions {
  art_style?: string;
  style?: string;
}

/** Provider interface: create job, get status, get result. */
export interface I3DProvider {
  readonly id: ProviderId;
  createGeneration(prompt: string, options?: CreateGenerationOptions): Promise<{ jobId: string; raw?: unknown }>;
  getStatus(jobId: string): Promise<{ status: GenerationStatus; progress?: number; raw?: unknown }>;
  getResult(jobId: string): Promise<NormalizedGenerationResult | null>;
}
