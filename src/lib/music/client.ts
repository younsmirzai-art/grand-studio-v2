/**
 * Grand Studio AI Music — client for Suno-based music generation API (sunoapi.org).
 * Uses MUSIC_API_KEY from environment. Do not expose provider name in UI.
 *
 * API docs (sunoapi.org simple generate API):
 * - Base URL: https://api.sunoapi.org
 * - Create:   POST /api/v1/generate
 * - Status:   GET  /api/v1/generate/record?taskId={TASK_ID}
 * - Auth:     Authorization: Bearer MUSIC_API_KEY
 */

const BASE_URL =
  process.env.MUSIC_API_BASE_URL?.replace(/\/$/, "") || "https://api.sunoapi.org";

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
    customMode: false,
    instrumental: true,
    model: "V4_5",
    prompt: `${prompt.slice(0, 400)}. Style: ${sound}`.slice(0, 500),
  };

  // Debug logging for troubleshooting 401 / endpoint issues
  // NOTE: This logs only high-level info, not secrets.
  // eslint-disable-next-line no-console
  console.log("[music/client] generateMusic request", {
    url: `${BASE_URL}/api/v1/generate`,
  });

  const res = await fetch(`${BASE_URL}/api/v1/generate`, {
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
  const data = (await res.json()) as
    | { task_id?: string }
    | { data?: { task_id?: string } }
    | { songs?: Array<{ id?: string }> };

  // eslint-disable-next-line no-console
  console.log("[music/client] FULL API response:", JSON.stringify(data));

  let taskId: string | undefined;
  if ("task_id" in data && data.task_id) {
    taskId = data.task_id;
  } else if ("data" in data && data.data?.task_id) {
    taskId = data.data.task_id;
  } else if ("songs" in data && Array.isArray(data.songs) && data.songs[0]?.id) {
    taskId = data.songs[0].id;
  }
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
    url: `${BASE_URL}/api/v1/generate/record?taskId=${taskId}`,
  });

  const res = await fetch(`${BASE_URL}/api/v1/generate/record?taskId=${encodeURIComponent(taskId)}`, {
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
  const raw = await res.json();
  const songs: Array<{ state?: string; audio_url?: string; image_url?: string }> | undefined =
    Array.isArray(raw?.songs) ? raw.songs : Array.isArray(raw) ? raw : undefined;
  if (songs && songs.length > 0) {
    const first = songs[0];
    const state = (first.state || "").toLowerCase(); // queued | streaming | succeeded | failed
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
