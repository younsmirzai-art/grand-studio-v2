import { NextResponse } from "next/server";
import { Resend } from "resend";

const WELCOME_FROM = "Grand Studio <welcome@grandstudio.dev>";
const TEST_TO = "mydreamvalid35@gmail.com";

export async function GET() {
  console.log("[test/welcome-email] Step 1: Route hit");
  try {
    const apiKey = process.env.RESEND_API_KEY;
    console.log("[test/welcome-email] Step 2: RESEND_API_KEY present:", !!apiKey);
    if (!apiKey) {
      console.log("[test/welcome-email] Step 2b: Missing RESEND_API_KEY, returning error");
      return NextResponse.json(
        { success: false, error: "RESEND_API_KEY not set" },
        { status: 503 }
      );
    }

    console.log("[test/welcome-email] Step 3: Creating Resend client");
    const resend = new Resend(apiKey);

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p>Hey there!</p>
  <p>This is a test welcome email from Grand Studio.</p>
  <p>If you received this, Resend is working correctly.</p>
  <p>- The Grand Studio Team</p>
</body>
</html>
    `.trim();

    console.log("[test/welcome-email] Step 4: Sending email to", TEST_TO, "from", WELCOME_FROM);
    const { data, error } = await resend.emails.send({
      from: WELCOME_FROM,
      to: TEST_TO,
      subject: "Welcome to Grand Studio! 🎉 (Test)",
      html,
    });

    if (error) {
      console.log("[test/welcome-email] Step 5: Resend error:", error);
      return NextResponse.json(
        { success: false, error: error.message ?? String(error) },
        { status: 500 }
      );
    }

    console.log("[test/welcome-email] Step 5: Welcome email sent successfully, id:", data?.id);
    return NextResponse.json({ success: true, id: data?.id });
  } catch (e) {
    console.log("[test/welcome-email] Step error: Exception", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
