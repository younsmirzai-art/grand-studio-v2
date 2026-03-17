const MESHY_BASE = "https://api.meshy.ai/v2";

function getHeaders(): HeadersInit {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new Error("MESHY_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export type TextTo3DArtStyle = "realistic" | "cartoon" | "low_poly" | "sculpture" | "pbr";

/**
 * Create a Text to 3D preview task. Returns task ID. Model takes 1-3 minutes to generate.
 */
export async function createTextTo3D(
  prompt: string,
  artStyle?: TextTo3DArtStyle
): Promise<string> {
  const res = await fetch(`${MESHY_BASE}/text-to-3d`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      mode: "preview",
      prompt,
      art_style: artStyle ?? "realistic",
      negative_prompt: "low quality, low resolution, low poly, ugly",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Meshy API error: ${res.status}`);
  }
  const data = (await res.json()) as { result?: string };
  if (!data.result) throw new Error("No task ID in response");
  return data.result;
}

/**
 * Create an Image to 3D task. Returns task ID.
 */
export async function createImageTo3D(imageUrl: string): Promise<string> {
  const res = await fetch(`${MESHY_BASE}/image-to-3d`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      image_url: imageUrl,
      enable_pbr: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Meshy API error: ${res.status}`);
  }
  const data = (await res.json()) as { result?: string };
  if (!data.result) throw new Error("No task ID in response");
  return data.result;
}

export type MeshyTaskStatus = "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED";

export interface MeshyTaskStatusResult {
  status: MeshyTaskStatus;
  progress?: number;
  model_urls?: {
    glb?: string;
    fbx?: string;
    obj?: string;
  };
}

/**
 * Get status of a Text to 3D or Image to 3D task.
 */
export async function getTaskStatus(taskId: string): Promise<MeshyTaskStatusResult> {
  const res = await fetch(`${MESHY_BASE}/text-to-3d/${taskId}`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Meshy status error: ${res.status}`);
  const data = (await res.json()) as { status?: string; progress?: number; model_urls?: { glb?: string; fbx?: string; obj?: string } };
  return {
    status: (data.status ?? "PENDING") as MeshyTaskStatus,
    progress: data.progress,
    model_urls: data.model_urls,
  };
}
