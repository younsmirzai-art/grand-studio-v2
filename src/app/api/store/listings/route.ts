import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const genre = searchParams.get("genre");
    const sort = searchParams.get("sort") || "trending";
    const maxPrice = searchParams.get("maxPrice");
    const minRating = searchParams.get("minRating");
    const search = searchParams.get("search")?.trim();

    const supabase = createServerClient();
    let query = supabase
      .from("game_store_listings")
      .select("*")
      .eq("status", "published");

    if (genre && genre !== "all") {
      query = query.eq("genre", genre);
    }
    if (minRating) {
      const r = parseFloat(minRating);
      if (!isNaN(r)) query = query.gte("rating", r);
    }
    if (maxPrice) {
      const p = parseFloat(maxPrice);
      if (!isNaN(p)) query = query.lte("price", p);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    switch (sort) {
      case "newest":
        query = query.order("published_at", { ascending: false });
        break;
      case "rating":
        query = query.order("rating", { ascending: false });
        break;
      case "price_asc":
        query = query.order("price", { ascending: true });
        break;
      case "price_desc":
        query = query.order("price", { ascending: false });
        break;
      case "downloads":
        query = query.order("download_count", { ascending: false });
        break;
      default:
        query = query.order("download_count", { ascending: false });
    }

    const { data, error } = await query.limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ listings: data ?? [] });
  } catch (e) {
    console.error("[store/listings] GET error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      projectId,
      sellerEmail,
      title,
      description,
      longDescription,
      genre,
      tags,
      price,
      isFree,
      thumbnailUrl,
      screenshots,
      trailerUrl,
      downloadUrl,
      fileSizeMb,
      platforms,
      systemRequirements,
      status,
    } = body as Record<string, unknown>;

    if (!String(sellerEmail ?? "").trim() || !String(title ?? "").trim() || !String(description ?? "").trim()) {
      return NextResponse.json(
        { error: "sellerEmail, title, description required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const row = {
      project_id: projectId ?? null,
      seller_email: String(sellerEmail).trim(),
      title: String(title).trim(),
      description: String(description).trim(),
      long_description: longDescription ? String(longDescription).trim() : null,
      genre: genre && ["action", "rpg", "horror", "adventure", "puzzle", "simulation", "strategy", "sports", "racing"].includes(String(genre)) ? String(genre) : "action",
      tags: Array.isArray(tags) ? tags : [],
      price: Math.max(0, Number(price) || 0),
      is_free: Boolean(isFree) || Number(price) === 0,
      currency: "usd",
      thumbnail_url: thumbnailUrl ? String(thumbnailUrl) : null,
      screenshots: Array.isArray(screenshots) ? screenshots : [],
      trailer_url: trailerUrl ? String(trailerUrl) : null,
      download_url: downloadUrl ? String(downloadUrl) : null,
      file_size_mb: Math.max(0, Number(fileSizeMb) || 0),
      platforms: Array.isArray(platforms) ? platforms : ["windows"],
      system_requirements: systemRequirements && typeof systemRequirements === "object" ? systemRequirements : {},
      status: status === "published" ? "published" : status === "under_review" ? "under_review" : "draft",
      published_at: status === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("game_store_listings")
      .insert(row)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    console.error("[store/listings] POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
