/**
 * Grand Studio AI Music — client using Hugging Face MusicGen (facebook/musicgen-small).
 * No provider names are exposed in the UI.
 *
 * API:
 * - Base URL: https://api-inference.huggingface.co/models/facebook/musicgen-small
 * - Generate: POST with JSON body { inputs: "<prompt>" }
 * - Response: binary audio (wav/flac)
 */

const HF_BASE_URL =
  process.env.MUSIC_API_BASE_URL?.replace(/\/$/, "") ||
  "https://api-inference.huggingface.co/models/facebook/musicgen-small";

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const token = process.env.HF_API_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
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
 * Generate music once (no polling) and upload to Supabase Storage.
 * Returns a public audio URL.
 */
export async function generateMusic(
  userId: string,
  prompt: string,
  style: string
): Promise<string> {
  const sound = STYLE_TO_SOUND[style] || style;
  const promptText = `${prompt} ${sound}`.trim();

  // eslint-disable-next-line no-console
  console.log("[music/client] generateMusic request", {
    url: HF_BASE_URL,
  });

  const res = await fetch(HF_BASE_URL, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ inputs: promptText }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.log("[music/client] generateMusic error", {
      status: res.status,
      body: err.slice(0, 500),
    });
    throw new Error(`Music API error: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();

  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  const timestamp = Date.now();
  const path = `${userId}/${timestamp}.wav`;

  const { data: uploadData, error } = await supabase.storage
    .from("generated-music")
    .upload(path, arrayBuffer, {
      contentType: "audio/wav",
      upsert: true,
    });

  if (error || !uploadData?.path) {
    throw new Error(`Failed to upload generated music: ${error?.message ?? "unknown error"}`);
  }

  const { data: publicData } = supabase.storage
    .from("generated-music")
    .getPublicUrl(uploadData.path);

  return publicData.publicUrl;
}
