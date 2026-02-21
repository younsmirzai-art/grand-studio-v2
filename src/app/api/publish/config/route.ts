import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId" },
        { status: 400 }
      );
    }
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("publish_configs")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ config: data });
  } catch (error) {
    console.error("[publish/config GET]", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      project_id,
      game_title,
      short_description,
      long_description,
      genre,
      tags,
      price,
      screenshots,
      header_image,
      build_config,
      status,
    } = body as {
      project_id?: string;
      game_title?: string;
      short_description?: string;
      long_description?: string;
      genre?: string;
      tags?: string[];
      price?: number;
      screenshots?: string[];
      header_image?: string;
      build_config?: Record<string, unknown>;
      status?: string;
    };

    if (!project_id) {
      return NextResponse.json(
        { error: "Missing project_id" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: existing } = await supabase
      .from("publish_configs")
      .select("id")
      .eq("project_id", project_id)
      .limit(1)
      .maybeSingle();

    const payload: Record<string, unknown> = {
      project_id,
      updated_at: new Date().toISOString(),
    };
    if (game_title !== undefined) payload.game_title = game_title;
    if (short_description !== undefined) payload.short_description = short_description;
    if (long_description !== undefined) payload.long_description = long_description;
    if (genre !== undefined) payload.genre = genre;
    if (tags !== undefined) payload.tags = tags;
    if (price !== undefined) payload.price = price;
    if (screenshots !== undefined) payload.screenshots = screenshots;
    if (header_image !== undefined) payload.header_image = header_image;
    if (build_config !== undefined) payload.build_config = build_config;
    if (status !== undefined) payload.status = status;

    if (existing) {
      const { data, error } = await supabase
        .from("publish_configs")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ config: data });
    }

    const { data, error } = await supabase
      .from("publish_configs")
      .insert({
        ...payload,
        game_title: game_title ?? "Untitled Game",
        status: status ?? "draft",
      })
      .select()
      .single();
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ config: data });
  } catch (error) {
    console.error("[publish/config POST]", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
