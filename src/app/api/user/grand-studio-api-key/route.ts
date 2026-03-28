import { NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";
import {
  generateGrandStudioApiKey,
  isGrandStudioApiKeyFormat,
} from "@/lib/plugin/grandStudioApiKey";

/**
 * GET — whether the signed-in user has an active Commander API key (no full secret).
 * POST — generate first key, or regenerate (body: { regenerate: true }).
 */
export async function GET() {
  const auth = await createServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data } = await supabase
    .from("api_keys")
    .select("api_key")
    .eq("user_email", user.email)
    .eq("is_active", true)
    .maybeSingle();

  const row = data as { api_key?: string } | null;
  const key = row?.api_key;
  return NextResponse.json({
    hasKey: Boolean(key && isGrandStudioApiKeyFormat(key)),
    keySuffix: key && key.length >= 4 ? key.slice(-4) : undefined,
  });
}

export async function POST(request: Request) {
  const auth = await createServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let regenerate = false;
  try {
    const body = (await request.json()) as { regenerate?: boolean };
    regenerate = body.regenerate === true;
  } catch {
    /* empty body */
  }

  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("api_keys")
    .select("id")
    .eq("user_email", user.email)
    .eq("is_active", true)
    .maybeSingle();

  if (!regenerate && existing) {
    return NextResponse.json(
      { error: "You already have an API key. Use Regenerate to rotate it." },
      { status: 409 },
    );
  }

  if (regenerate) {
    await supabase.from("api_keys").update({ is_active: false }).eq("user_email", user.email);
  }

  const apiKey = generateGrandStudioApiKey();
  const { error } = await supabase.from("api_keys").insert({
    user_email: user.email,
    api_key: apiKey,
    name: "UE5 Commander",
    is_active: true,
  });

  if (error) {
    console.error("[grand-studio-api-key] insert error", error);
    return NextResponse.json({ error: "Failed to save API key" }, { status: 500 });
  }

  return NextResponse.json({ apiKey });
}
