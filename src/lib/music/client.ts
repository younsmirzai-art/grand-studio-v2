/**
 * Grand Studio AI Music — client for music generation API.
 * Uses MUSIC_API_KEY from environment. Do not expose provider name in UI.
 */

const BASE_URL =
  process.env.MUSIC_API_BASE_URL?.replace(/\/$/, "") || "https://api.musicapi.ai";

function getHeaders(): HeadersInit {
  const key = process.env.MUSIC_API_KEY;
  if (!key) throw new Error("MUSIC_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export type MusicStyle =
  | "epic_orchestral"
  | "ambient"
  | "electronic"
  | "rock"
  | "jazz"
  | "cinematic"
  | "horror"
  | "fantasy";

const STYLE_TO_SOUND: Record<string, string> = {
  epic_orchestral: "epic orchestral film score, dramatic, cinematic",
  ambient: "ambient, atmospheric, calm, pads",
  electronic: "electronic, synth, modern production",
  rock: "rock, guitar, drums, energetic",
  jazz: "jazz, smooth, piano, brass",
  cinematic: "cinematic, movie score, emotional",
  horror: "horror, suspense, dark, tension",
  fantasy: "fantasy, magical, orchestral, adventure",
};

/**
 * Create a music generation task. Returns task_id for polling.
 */
export async function generateMusic(
  prompt: string,
  style: string,
  durationSeconds: number
): Promise<string> {
  const sound = STYLE_TO_SOUND[style] || style;
  const body = {
    task_type: "create_music",
    mv: "FUZZ-2.0",
    sound: `${prompt}. Style: ${sound}`.slice(0, 500),
    title: prompt.slice(0, 80) || "Grand Studio track",
    make_instrumental: true,
  };
  const res = await fetch(`${BASE_URL}/api/v1/producer/create`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Music API error: ${res.status}. ${err.slice(0, 200)}`);
  }
  const data = (await res.json()) as { data?: { task_id?: string }; task_id?: string };
  const taskId = data.data?.task_id ?? data.task_id;
  if (!taskId) throw new Error("No task_id in music API response");
  return String(taskId);
}

export interface MusicTaskStatus {
  status: "pending" | "running" | "succeeded" | "failed";
  progress?: number;
  audioUrl?: string;
  error?: string;
}

/**
 * Get task status. When status is succeeded, audioUrl is set.
 */
export async function getTaskStatus(taskId: string): Promise<MusicTaskStatus> {
  const res = await fetch(`${BASE_URL}/api/v1/producer/task/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) {
    return { status: "failed", error: `Request failed: ${res.status}` };
  }
  const data = (await res.json()) as {
    data?: Array<{ state?: string; audio_url?: string }>;
    code?: number;
  };
  const items = data.data;
  if (items && items.length > 0) {
    const first = items[0];
    const state = (first.state || "").toLowerCase();
    const audioUrl = first.audio_url ?? undefined;
    if (state === "succeeded" && audioUrl) {
      return { status: "succeeded", audioUrl };
    }
    if (state === "failed") {
      return { status: "failed", error: "Generation failed" };
    }
    return {
      status: state === "running" ? "running" : "pending",
      progress: state === "running" ? 50 : undefined,
    };
  }
  return { status: "pending" };
}
