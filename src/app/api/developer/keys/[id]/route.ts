import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { is_active } = body as { is_active?: boolean };
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("api_keys")
      .update({ is_active: is_active ?? false })
      .eq("id", id)
      .select("id, is_active")
      .single();
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({
      id: data.id,
      is_active: data.is_active,
      message: data.is_active ? "Key activated" : "Key revoked",
    });
  } catch (error) {
    console.error("[developer/keys PATCH]", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
