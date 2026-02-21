import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/api/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return unauthorizedResponse();

  try {
    const { id: templateId } = await params;
    const body = await request.json().catch(() => ({}));
    const { projectId } = body as { projectId?: string };

    const supabase = createServerClient();
    const { data: template, error: templateError } = await supabase
      .from("game_templates")
      .select("id, name, ue5_code, download_count")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    let targetProjectId: string;
    if (projectId) {
      const { data: proj } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .single();
      if (!proj) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }
      targetProjectId = projectId;
    } else {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          name: (template as { name: string }).name,
          initial_prompt: `Built from template: ${(template as { name: string }).name}`,
          status: "active",
        })
        .select("id")
        .single();
      if (projectError || !project) {
        return NextResponse.json(
          { error: (projectError as { message: string })?.message ?? "Failed to create project" },
          { status: 500 }
        );
      }
      targetProjectId = (project as { id: string }).id;
    }

    await supabase.from("ue5_commands").insert({
      project_id: targetProjectId,
      code: (template as { ue5_code: string }).ue5_code,
      status: "pending",
    });

    await supabase.from("template_usage").insert({
      template_id: templateId,
      project_id: targetProjectId,
    });

    const currentCount = (template as { download_count?: number }).download_count ?? 0;
    await supabase
      .from("game_templates")
      .update({
        download_count: currentCount + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId);

    return NextResponse.json({
      status: "building",
      projectId: targetProjectId,
    });
  } catch (error) {
    console.error("[v1/templates/use]", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
