import { randomBytes } from "crypto";
import { createServerClient } from "@/lib/supabase/server";

export const GRAND_STUDIO_API_KEY_PREFIX = "gs_";
/** Minimum total length including prefix (gs_ + payload). */
export const GRAND_STUDIO_API_KEY_MIN_LENGTH = 20;

export function isGrandStudioApiKeyFormat(key: string): boolean {
  const k = key.trim();
  return k.startsWith(GRAND_STUDIO_API_KEY_PREFIX) && k.length >= GRAND_STUDIO_API_KEY_MIN_LENGTH;
}

/** gs_ + 32 random hex chars (16 bytes). */
export function generateGrandStudioApiKey(): string {
  return `${GRAND_STUDIO_API_KEY_PREFIX}${randomBytes(16).toString("hex")}`;
}

/** Active key row exists (does not increment usage). */
export async function grandStudioApiKeyExistsInDatabase(apiKey: string): Promise<boolean> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id")
    .eq("api_key", apiKey.trim())
    .eq("is_active", true)
    .maybeSingle();
  return !error && !!data;
}
