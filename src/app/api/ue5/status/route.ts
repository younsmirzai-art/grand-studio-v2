import { NextResponse } from "next/server";

/** Relay heartbeat checks removed; website no longer depends on a local relay process. */
export async function GET() {
  return NextResponse.json({
    relay_online: false,
    relay_deprecated: true,
    ue5_connected: false,
    last_ping: null,
    message: "Use workspace downloads for models; optional Commander plugin for in-editor automation.",
  });
}
