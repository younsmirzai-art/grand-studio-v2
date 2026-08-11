import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("favorites")
    .select("*")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ favorites: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as {
    modelId?: string;
    modelName?: string;
    modelThumbnail?: string;
  };

  if (!body.modelId || !body.modelName) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { error } = await supabase.from("favorites").insert({
    user_id: user.id,
    model_id: body.modelId,
    model_name: body.modelName,
    model_thumbnail: body.modelThumbnail || null,
    model_source: "polyhaven",
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ success: true, alreadyFavorited: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const modelId = new URL(request.url).searchParams.get("modelId");
  if (!modelId) {
    return NextResponse.json({ error: "Missing modelId" }, { status: 400 });
  }

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("model_id", modelId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
