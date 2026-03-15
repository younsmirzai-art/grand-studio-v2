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

    const confirmHtml = `
      <p>Hi ${name},</p>
      <p>Thanks for contacting Grand Studio support. We received your message about <strong>${subject}</strong> and will get back to you within 24 hours.</p>
      <p>- The Grand Studio Team</p>
    `;
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
