import { NextResponse } from "next/server";
import { Resend } from "resend";

const WELCOME_FROM = "Grand Studio <welcome@grandstudio.dev>";
const TEST_TO = "mydreamvalid35@gmail.com";

const WELCOME_HTML_TEMPLATE = `<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#0A0A0B;font-family:Arial,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:40px 20px;"><div style="text-align:center;padding:30px 0;border-bottom:1px solid #2A2A30;"><h1 style="color:#FFFFFF;font-size:28px;margin:0;letter-spacing:0.1em;">🎮 GRAND STUDIO</h1><p style="color:#2196F3;font-size:14px;margin:8px 0 0 0;">UE5 AI Co-Pilot</p></div><div style="background-color:#111114;border-radius:16px;padding:40px;margin:30px 0;border:1px solid #2A2A30;"><h2 style="color:#FFFFFF;font-size:24px;margin:0 0 16px 0;">Welcome aboard! 🚀</h2><p style="color:#A0A0A8;font-size:16px;line-height:1.8;margin:0 0 24px 0;">Hey {{name}}, you just joined the future of UE5 development. Grand Studio lets you build professional 3D scenes 10x faster using AI.</p><h3 style="color:#FFFFFF;font-size:18px;margin:0 0 16px 0;">What you can do:</h3><div style="background-color:#1A1A1F;border-radius:12px;padding:20px;margin:0 0 12px 0;border-left:3px solid #2196F3;"><p style="color:#FFFFFF;font-size:15px;margin:0;">🤖 <strong>AI Co-Pilot</strong></p><p style="color:#A0A0A8;font-size:13px;margin:4px 0 0 0;">Describe scenes in plain English, AI writes the UE5 code</p></div><div style="background-color:#1A1A1F;border-radius:12px;padding:20px;margin:0 0 12px 0;border-left:3px solid #00BCD4;"><p style="color:#FFFFFF;font-size:15px;margin:0;">📦 <strong>Import Real 3D Models</strong></p><p style="color:#A0A0A8;font-size:13px;margin:4px 0 0 0;">Thousands of free models from Poly Haven and Sketchfab</p></div><div style="background-color:#1A1A1F;border-radius:12px;padding:20px;margin:0 0 24px 0;border-left:3px solid #4CAF50;"><p style="color:#FFFFFF;font-size:15px;margin:0;">⚡ <strong>Live UE5 Integration</strong></p><p style="color:#A0A0A8;font-size:13px;margin:4px 0 0 0;">Code executes directly in Unreal Engine in real-time</p></div><h3 style="color:#FFFFFF;font-size:18px;margin:0 0 16px 0;">Get started in 3 steps:</h3><div style="margin:0 0 24px 0;"><p style="color:#A0A0A8;font-size:14px;line-height:2;margin:0;"><span style="color:#2196F3;font-weight:bold;">01</span> Download the Relay Bridge<br><span style="color:#2196F3;font-weight:bold;">02</span> Open UE5 and enable Web Remote Control<br><span style="color:#2196F3;font-weight:bold;">03</span> Start building amazing scenes</p></div><div style="text-align:center;margin:30px 0 0 0;"><a href="https://grandstudio.dev/connect" style="display:inline-block;background:linear-gradient(135deg,#2196F3,#00BCD4);color:#FFFFFF;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:bold;font-size:16px;letter-spacing:0.05em;">START BUILDING</a></div></div><div style="text-align:center;padding:20px 0;"><p style="color:#606068;font-size:12px;margin:0;">Need help? <a href="https://grandstudio.dev/support" style="color:#2196F3;text-decoration:none;">Contact Support</a></p><p style="color:#606068;font-size:12px;margin:8px 0 0 0;">© 2026 Grand Studio. All rights reserved.</p></div></div></body></html>`;

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

    const html = WELCOME_HTML_TEMPLATE.replace(/\{\{name\}\}/g, "there");

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
