import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * Magic-link OTP does not need cookies — use a plain anon client.
 * Cookie SSR client with no-op setAll can interfere with auth flows.
 */
function createOtpClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    throw new Error(
      `Supabase env not configured (hasUrl=${Boolean(url)}, hasAnon=${Boolean(anon)}, urlLen=${url?.length ?? 0}, anonLen=${anon?.length ?? 0})`
    );
  }
  return createClient(url, anon, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400 }
      );
    }

    const supabase = createOtpClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
    const redirectTo = `${siteUrl.replace(/\/$/, "")}/auth/callback?next=/dashboard`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });

    if (error) {
      console.error(
        "[magic-link] send failed:",
        error.name,
        error.status,
        error.message
      );
      return NextResponse.json(
        {
          error: "Failed to send magic link",
          detail: error.message,
          errorType: error.name,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("MAGIC_LINK_ERROR", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : "Unknown",
    });
    return NextResponse.json(
      {
        error: "Failed to send magic link",
        detail: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.name : "Unknown",
      },
      { status: 500 }
    );
  }
}
