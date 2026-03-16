import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerAuthClient } from "@/lib/supabase/server";
import { getEffectivePlan } from "@/lib/usage/usageTracker";

const SUPPORT_EMAIL = "peterparker668855@gmail.com";
const SUPPORT_FROM = "Grand Studio Support <support@grandstudio.dev>";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body as { name?: string; email?: string; subject?: string; message?: string };

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Name, email, subject, and message are required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Support is not configured. Please try again later." },
        { status: 503 }
      );
    }

    let plan = "Not logged in";
    try {
      const supabase = await createServerAuthClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        plan = await getEffectivePlan(user.id);
      }
    } catch {
      // ignore
    }

    const resend = new Resend(apiKey);
    const emailSubject = `[Grand Studio Support] ${subject} from ${name}`;
    const supportHtml = `
      <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Plan:</strong> ${plan}</p>
      <hr />
      <p>${message.replace(/\n/g, "<br />")}</p>
    `;

    const { error: supportError } = await resend.emails.send({
      from: SUPPORT_FROM,
      to: SUPPORT_EMAIL,
      subject: emailSubject,
      html: supportHtml,
    });

    if (supportError) {
      console.error("[support/contact] Resend error:", supportError);
      return NextResponse.json(
        { error: supportError.message ?? "Failed to send email." },
        { status: 500 }
      );
    }

    const safeName = String(name).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeSubject = String(subject).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const confirmHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#0A0A0B;font-family:Arial,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:40px 20px;"><div style="text-align:center;padding:30px 0;border-bottom:1px solid #2A2A30;"><h1 style="color:#FFFFFF;font-size:28px;margin:0;letter-spacing:0.1em;">🎮 GRAND STUDIO</h1><p style="color:#2196F3;font-size:14px;margin:8px 0 0 0;">Support</p></div><div style="background-color:#111114;border-radius:16px;padding:40px;margin:30px 0;border:1px solid #2A2A30;"><h2 style="color:#FFFFFF;font-size:24px;margin:0 0 16px 0;">We received your message ✓</h2><p style="color:#A0A0A8;font-size:16px;line-height:1.8;margin:0 0 16px 0;">Hi ${safeName},</p><p style="color:#A0A0A8;font-size:16px;line-height:1.8;margin:0 0 24px 0;">Thanks for contacting Grand Studio support. We received your message about <strong style="color:#FFFFFF;">${safeSubject}</strong>.</p><div style="background-color:#1A1A1F;border-radius:12px;padding:20px;margin:0 0 24px 0;border-left:3px solid #2196F3;"><p style="color:#FFFFFF;font-size:15px;margin:0;">We will get back to you within 24 hours.</p></div><p style="color:#A0A0A8;font-size:14px;margin:0;">— The Grand Studio Team</p></div><div style="text-align:center;padding:20px 0;"><p style="color:#606068;font-size:12px;margin:0;"><a href="https://grandstudio.dev/support" style="color:#2196F3;text-decoration:none;">Contact Support</a></p><p style="color:#606068;font-size:12px;margin:8px 0 0 0;">© 2026 Grand Studio. All rights reserved.</p></div></div></body></html>`;
    await resend.emails.send({
      from: SUPPORT_FROM,
      to: email,
      subject: "We received your message!",
      html: confirmHtml,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[support/contact]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
