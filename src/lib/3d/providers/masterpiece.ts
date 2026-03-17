/**
 * Grand Forge 3D generation provider (Masterpiece X API).
 * Uses MASTERPIECE_API_KEY and optional MASTERPIECE_BASE_URL.
 * Never exposes the third-party name in UI; we use "Grand Forge" as our own.
 */

import type {
  I3DProvider,
  NormalizedGenerationResult,
  GenerationStatus,
} from "./base";
import { getMasterpieceConfig } from "./config";

const PROVIDER_ID = "masterpiece" as const;

function mapStatus(s: string): GenerationStatus {
  const lower = (s || "").toLowerCase();
  if (lower === "complete" || lower === "completed") return "complete";
  if (lower === "failed") return "failed";
  if (lower === "pending" || lower === "processing" || lower === "in_progress")
    return "in_progress";
  return (s as GenerationStatus) || "pending";
}

export const masterpieceProvider: I3DProvider = {
  id: PROVIDER_ID,

  async createGeneration(prompt: string) {
    const { apiKey, baseUrl } = getMasterpieceConfig();
    if (!apiKey) {
      console.error("[Grand Forge] MASTERPIECE_API_KEY is not set");
      throw new Error("Grand Forge is not configured. Set MASTERPIECE_API_KEY.");
    }
    console.log("[Grand Forge] Generation started.", { promptLength: prompt?.length });
    const res = await fetch(`${baseUrl}/functions/general`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: prompt.trim() }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[Grand Forge] Create request failed:", res.status, err);
      throw new Error(
        `Grand Forge API error: ${res.status}. ${err.slice(0, 200)}`
      );
    }
    const data = (await res.json()) as {
      requestId?: string;
      status?: string;
      balance?: number;
    };
    const jobId = data.requestId;
    if (!jobId) {
      console.error("[Grand Forge] No requestId in response", data);
      throw new Error("Grand Forge did not return a job ID.");
    }
    console.log("[Grand Forge] Provider job created.", { requestId: jobId });
    return { jobId, raw: data };
  },

  async getStatus(jobId: string) {
    const { apiKey, baseUrl } = getMasterpieceConfig();
    if (!apiKey) throw new Error("Grand Forge is not configured.");
    const res = await fetch(`${baseUrl}/status/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      console.warn("[Grand Forge] Status request failed:", res.status);
      return { status: "pending" as GenerationStatus, raw: undefined };
    }
    const data = (await res.json()) as {
      requestId?: string;
      status?: string;
      progress?: number;
      outputUrl?: string;
      outputs?: { glb?: string; thumbnail?: string };
    };
    const status = mapStatus(data.status ?? "pending");
    return {
      status,
      progress: data.progress ?? undefined,
      raw: data,
    };
  },

  async getResult(jobId: string): Promise<NormalizedGenerationResult | null> {
    const { apiKey, baseUrl } = getMasterpieceConfig();
    if (!apiKey) throw new Error("Grand Forge is not configured.");
    const res = await fetch(`${baseUrl}/status/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      requestId?: string;
      status?: string;
      progress?: number;
      outputUrl?: string;
      outputs?: { glb?: string; fbx?: string; thumbnail?: string };
      error?: string;
    };
    const status = mapStatus(data.status ?? "pending");
    const isComplete = status === "complete" || status === "completed";
    const assetUrl =
      data.outputUrl ??
      data.outputs?.glb ??
      data.outputs?.fbx ??
      null;
    const previewUrl = data.outputs?.thumbnail ?? null;
    const fileType = assetUrl
      ? assetUrl.includes(".fbx")
        ? "fbx"
        : "glb"
      : "glb";

    console.log("[Grand Forge] Result fetched.", {
      jobId,
      status,
      hasAsset: !!assetUrl,
      hasPreview: !!previewUrl,
    });

    return {
      provider: PROVIDER_ID,
      provider_job_id: jobId,
      status,
      prompt: "", // caller should pass prompt from DB
      preview_url: previewUrl,
      asset_url: assetUrl,
      file_type: fileType,
      raw_response: data,
      error_message: data.error ?? (status === "failed" ? "Generation failed" : null),
      progress: data.progress,
    };
  },
};
