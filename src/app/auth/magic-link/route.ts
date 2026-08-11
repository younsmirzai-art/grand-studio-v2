import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

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

    const supabase = await createServerAuthClient();
    const origin = request.nextUrl.origin;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      console.error("[magic-link] send failed");
      return NextResponse.json(
        { error: "Failed to send magic link" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
