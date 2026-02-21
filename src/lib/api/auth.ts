import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export interface ApiKeyAuth {
  valid: boolean;
  keyId?: string;
  email?: string;
}

/**
 * Validate X-API-Key header. Checks prefix gs_, lookup in api_keys, rate limit (per day), increments usage.
 */
export async function validateApiKey(request: Request): Promise<ApiKeyAuth> {
  const apiKey = request.headers.get("X-API-Key");
  if (!apiKey || !apiKey.startsWith("gs_")) {
    return { valid: false };
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, user_email, is_active, rate_limit, usage_count, last_used_at")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (error || !data) return { valid: false };
  if (!(data as { is_active?: boolean }).is_active) return { valid: false };

  const key = data as {
    id: string;
    user_email: string;
    rate_limit: number;
    usage_count: number;
    last_used_at: string | null;
  };
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const lastUsed = key.last_used_at ? key.last_used_at.slice(0, 10) : null;
  let usageCount = key.usage_count ?? 0;
  if (lastUsed !== today) {
    usageCount = 0;
  }
  if (usageCount >= (key.rate_limit ?? 100)) {
    return { valid: false };
  }

  await supabase
    .from("api_keys")
    .update({
      usage_count: usageCount + 1,
      last_used_at: now.toISOString(),
    })
    .eq("id", key.id);

  return { valid: true, keyId: key.id, email: key.user_email };
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Invalid or missing API key. Use X-API-Key: gs_..." },
    { status: 401 }
  );
}
