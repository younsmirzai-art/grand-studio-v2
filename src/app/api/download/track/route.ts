import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      modelId?: string;
      format?: string;
    };
    const { modelId, format } = body;

    if (!modelId || !format) {
      return NextResponse.json(
        { success: false, error: "modelId and format required" },
        { status: 400 }
      );
    }

    // TODO Phase 6: persist to Supabase downloads table
    console.log("Download tracked:", {
      modelId,
      format,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
