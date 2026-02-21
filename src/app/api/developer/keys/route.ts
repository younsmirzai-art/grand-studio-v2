import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

function generateApiKey(): string {
  return "gs_live_" + randomBytes(24).toString("base64url");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_email, name } = body as { user_email?: string; name?: string };
    if (!user_email || typeof user_email !== "string") {
      return NextResponse.json(
        { error: "Missing user_email" },
        { status: 400 }
      );
    }
    const keyName = (name && typeof name === "string" ? name.trim() : "Default") || "Default";
    const apiKey = generateApiKey();
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        user_email: user_email.trim(),
        api_key: apiKey,
        name: keyName,
        is_active: true,
        rate_limit: 100,
      })
      .select("id, name, rate_limit, created_at")
      .single();
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({
      api_key: apiKey,
      id: data.id,
      name: data.name,
      rate_limit: data.rate_limit,
      message: "Copy your API key now. It will not be shown again.",
    });
  } catch (error) {
    console.error("[developer/keys POST]", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_email = searchParams.get("user_email");
    if (!user_email) {
      return NextResponse.json(
        { error: "Missing user_email query" },
        { status: 400 }
      );
    }
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, is_active, rate_limit, usage_count, last_used_at, created_at")
      .eq("user_email", user_email.trim())
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    const keys = (data ?? []).map((k) => ({
      ...k,
      api_key_masked: "gs_live_***" + (k.id as string).slice(-4),
    }));
    return NextResponse.json({ keys });
  } catch (error) {
    console.error("[developer/keys GET]", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
