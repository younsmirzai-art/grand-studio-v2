/**
 * Grand Studio AI Music — client for music generation API.
 * Uses MUSIC_API_KEY from environment. Do not expose provider name in UI.
 *
 * API docs (musicapi.ai Sonic API):
 * - Base URL: https://api.musicapi.ai
 * - Create:   POST /api/v1/sonic/create
 * - Status:   GET  /api/v1/sonic/task/{TASK_ID}
 * - Auth:     Authorization: Bearer MUSIC_API_KEY
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
    custom_mode: false,
    mv: "sonic-v4-5",
    title: prompt.slice(0, 80) || "Grand Studio track",
    tags: sound.slice(0, 120),
    gpt_description_prompt: prompt.slice(0, 500),
    instrumental: true,
  };

  // Debug logging for troubleshooting 401 / endpoint issues
  // NOTE: This logs only high-level info, not secrets.
  // eslint-disable-next-line no-console
  console.log("[music/client] generateMusic request", {
    url: `${BASE_URL}/api/v1/sonic/create`,
    mv: body.mv,
  });

  const res = await fetch(`${BASE_URL}/api/v1/sonic/create`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    // eslint-disable-next-line no-console
    console.log("[music/client] generateMusic error", {
      status: res.status,
      body: err.slice(0, 500),
    });
    throw new Error(`Music API error: ${res.status}. ${err.slice(0, 200)}`);
  }
  const data = (await res.json()) as { task_id?: string; data?: { task_id?: string } };
  const taskId = data.task_id ?? data.data?.task_id;
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
  // eslint-disable-next-line no-console
  console.log("[music/client] getTaskStatus request", {
    url: `${BASE_URL}/api/v1/sonic/task/${taskId}`,
  });

  const res = await fetch(`${BASE_URL}/api/v1/sonic/task/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.log("[music/client] getTaskStatus error", {
      status: res.status,
      body: err.slice(0, 500),
    });
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
