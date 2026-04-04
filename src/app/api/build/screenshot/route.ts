import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Screenshot queue was part of the removed relay. Capture from the editor or use the Commander plugin.",
      code: "RELAY_REMOVED",
    },
    { status: 503 }
  );
}
