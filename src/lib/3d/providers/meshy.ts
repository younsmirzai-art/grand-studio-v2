/**
 * Meshy 3D generation provider adapter.
 * Wraps existing Meshy client and normalizes to shared result shape.
 */

import {
  createTextTo3D,
  getTaskStatus,
  getImageTo3DStatus,
  getRetextureStatus,
} from "@/lib/meshy/client";
import type {
  I3DProvider,
  NormalizedGenerationResult,
  GenerationStatus,
  CreateGenerationOptions,
} from "./base";

const PROVIDER_ID = "meshy" as const;

function mapMeshyStatus(s: string): GenerationStatus {
  if (s === "SUCCEEDED") return "complete";
  if (s === "FAILED") return "failed";
  if (s === "PENDING" || s === "IN_PROGRESS") return "in_progress";
  return (s as GenerationStatus) || "pending";
}

export const meshyProvider: I3DProvider = {
  id: PROVIDER_ID,

  async createGeneration(
    prompt: string,
    options?: CreateGenerationOptions
  ): Promise<{ jobId: string; raw?: unknown }> {
    const artStyle = (options?.art_style || options?.style || "realistic") as
      | "realistic"
      | "cartoon"
      | "low_poly"
      | "sculpture"
      | "pbr";
    const jobId = await createTextTo3D(prompt.trim(), artStyle);
    return { jobId, raw: { result: jobId } };
  },

  async getStatus(jobId: string) {
    const result = await getTaskStatus(jobId);
    const status = mapMeshyStatus(result.status);
    return {
      status,
      progress: result.progress,
      raw: result,
    };
  },

  async getResult(jobId: string): Promise<NormalizedGenerationResult | null> {
    const result = await getTaskStatus(jobId);
    const status = mapMeshyStatus(result.status);
    const assetUrl =
      result.model_urls?.glb ??
      (result as { model_url?: string }).model_url ??
      null;
    return {
      provider: PROVIDER_ID,
      provider_job_id: jobId,
      status,
      prompt: "",
      preview_url: null,
      asset_url: assetUrl,
      file_type: "glb",
      raw_response: result,
      error_message: status === "failed" ? "Generation failed" : null,
      progress: result.progress,
    };
  },
};
