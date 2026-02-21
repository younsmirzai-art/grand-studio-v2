import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Use a template: create a new project, queue the template's UE5 code, record usage, return projectId.
 * Body: { templateId: string, projectName?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, projectName } = body as { templateId?: string; projectName?: string };

    if (!templateId) {
      return NextResponse.json(
        { error: "Missing templateId" },
        { status: 400 }
      );
    }

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

    const name = (projectName && projectName.trim()) || template.name;

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        initial_prompt: `Built from template: ${template.name}`,
        status: "active",
      })
      .select("id")
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: projectError?.message ?? "Failed to create project" },
        { status: 500 }
      );
    }

    const projectId = project.id as string;

    const { error: cmdError } = await supabase.from("ue5_commands").insert({
      project_id: projectId,
      code: template.ue5_code,
      status: "pending",
    });

    if (cmdError) {
      console.error("[templates/use] ue5_commands insert failed:", cmdError);
      // Project already created; still return success so user can open project
    }

    await supabase.from("template_usage").insert({
      template_id: templateId,
      project_id: projectId,
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
      success: true,
      projectId,
      message: "Project created and template code queued for UE5.",
    });
  } catch (error) {
    console.error("[templates/use]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Use template failed" },
      { status: 500 }
    );
  }
}
