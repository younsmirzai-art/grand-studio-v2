import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/api/auth";

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { name, prompt } = body as { name?: string; prompt?: string };
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid name" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        initial_prompt: (prompt && typeof prompt === "string" ? prompt.trim() : "") || "",
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      projectId: data.id,
      status: "created",
    });
  } catch (error) {
    console.error("[v1/projects]", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
