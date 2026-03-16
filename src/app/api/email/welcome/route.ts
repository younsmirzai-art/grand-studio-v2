import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";

const WELCOME_FROM = "Grand Studio <welcome@grandstudio.dev>";

function getWelcomeHtml(displayName: string) {
  return `
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
  `.trim();
}

export async function POST(request: NextRequest) {
  console.log("[api/email/welcome] Step 1: POST /api/email/welcome called");
  try {
    const supabaseAuth = await createServerAuthClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      console.log("[api/email/welcome] Step 2: No user, unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;
    const toEmail = user.email;
    console.log("[api/email/welcome] Step 2: User loaded", userId, "email:", toEmail);
    if (!toEmail) {
      console.log("[api/email/welcome] Step 2b: No email for user, skipping");
      return NextResponse.json({ error: "No email" }, { status: 400 });
    }

    const serverSupabase = createServerClient();
    const { data: existing } = await serverSupabase
      .from("welcome_email_sent")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      console.log("[api/email/welcome] Step 3: Welcome email already sent for user", userId, ", skipping");
      return NextResponse.json({ sent: false, reason: "already_sent" });
    }
    console.log("[api/email/welcome] Step 3: No welcome_email_sent row, will send");

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log("[api/email/welcome] Step 4: RESEND_API_KEY not set");
      return NextResponse.json({ error: "Email not configured" }, { status: 503 });
    }
    const displayName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? toEmail) as string;
    const resend = new Resend(apiKey);
    const html = getWelcomeHtml(displayName);

    console.log("[api/email/welcome] Step 5: Sending welcome email to", toEmail);
    const { error: sendError } = await resend.emails.send({
      from: WELCOME_FROM,
      to: toEmail,
      subject: "Welcome to Grand Studio! 🎉",
      html,
    });

    if (sendError) {
      console.log("[api/email/welcome] Step 6: Welcome email error:", sendError);
      return NextResponse.json(
        { error: sendError.message ?? "Failed to send" },
        { status: 500 }
      );
    }
    console.log("[api/email/welcome] Step 6: Welcome email sent successfully");

    const { error: insertError } = await serverSupabase
      .from("welcome_email_sent")
      .insert({ user_id: userId });
    if (insertError) {
      console.log("[api/email/welcome] Step 7: Failed to insert welcome_email_sent:", insertError);
      return NextResponse.json(
        { error: "Email sent but failed to record" },
        { status: 500 }
      );
    }
    console.log("[api/email/welcome] Step 7: welcome_email_sent row inserted");
    return NextResponse.json({ sent: true });
  } catch (e) {
    console.log("[api/email/welcome] Step error: Exception", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
