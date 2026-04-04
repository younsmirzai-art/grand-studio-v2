import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Command status was part of the removed relay pipeline.", code: "RELAY_REMOVED" },
    { status: 410 }
  );
}
