import { createServerClient as createSSRClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { createServerClient } from "@/lib/supabase/server";

const WELCOME_FROM = "Grand Studio <welcome@grandstudio.dev>";

async function sendWelcomeEmail(user: { email?: string; user_metadata?: Record<string, unknown> }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const email = user.email;
  if (!email) return;

  const name = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? email) as string;
  const displayName = name && name !== email ? name : email;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: WELCOME_FROM,
    to: email,
    subject: "Welcome to Grand Studio! 🎉",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p>Hey ${displayName}!</p>
  <p>Welcome to Grand Studio — the AI Co-Pilot for Unreal Engine 5.</p>
  <p>You now have access to:</p>
  <ul>
    <li>AI-powered scene building</li>
    <li>Import 3D models from Poly Haven & Sketchfab</li>
    <li>Real-time UE5 integration</li>
  </ul>
  <p><strong>Get started in 3 steps:</strong></p>
  <ol>
    <li>Download the Relay Bridge: <a href="https://grandstudio.dev/connect">https://grandstudio.dev/connect</a></li>
    <li>Open UE5 and enable Web Remote Control</li>
    <li>Start building amazing scenes!</li>
  </ol>
  <p>Need help? Visit <a href="https://grandstudio.dev/support">https://grandstudio.dev/support</a></p>
  <p>Happy building!<br/>The Grand Studio Team</p>
</body>
</html>
    `.trim(),
  });
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createSSRClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // setAll can throw in Server Components — safe to ignore here
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      const user = data.user;
      const userId = user.id;

      let shouldSendWelcome = false;
      let welcomeReason = "";

      if (!process.env.RESEND_API_KEY) {
        welcomeReason = "RESEND_API_KEY not set";
        console.log("[auth/callback] Welcome email not sent:", welcomeReason);
      } else if (!user.email) {
        welcomeReason = "user has no email";
        console.log("[auth/callback] Welcome email not sent:", welcomeReason);
      } else {
        const serverSupabase = createServerClient();
        const [projectsRes, usageRes] = await Promise.all([
          serverSupabase.from("projects").select("id").eq("user_id", userId).limit(1),
          serverSupabase.from("usage_logs").select("id").eq("user_id", userId).limit(1),
        ]);
        const hasProjects = (projectsRes.data?.length ?? 0) > 0;
        const hasUsage = (usageRes.data?.length ?? 0) > 0;
        if (!hasProjects && !hasUsage) {
          shouldSendWelcome = true;
          welcomeReason = "new user (zero projects, zero usage_logs)";
        } else {
          welcomeReason = `existing user (projects: ${hasProjects}, usage_logs: ${hasUsage})`;
          console.log("[auth/callback] Welcome email not sent:", welcomeReason);
        }
      }

      if (shouldSendWelcome) {
        console.log("[auth/callback] Sending welcome email:", welcomeReason);
        sendWelcomeEmail(user).catch((e) => {
          console.error("[auth/callback] Welcome email failed:", e);
        });
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/login?error=Could not authenticate`
  );
}
