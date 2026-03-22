import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";
import { queueUE5Command } from "@/lib/ue5/commands";

const PLACEMENT_TEST_PYTHON = `import unreal
editor = unreal.EditorLevelLibrary
import_dir = '/Game/GrandStudio/Imported'
all_assets = unreal.EditorAssetLibrary.list_assets(import_dir, recursive=True)
unreal.log(f'Found {len(all_assets)} total assets in Imported folder')
static_meshes = []
for a in all_assets:
    clean = a.split('.')[0]
    obj = unreal.EditorAssetLibrary.load_asset(clean)
    if obj and obj.get_class().get_name() == 'StaticMesh':
        static_meshes.append(clean)
        unreal.log(f'StaticMesh found: {clean}')
unreal.log(f'Found {len(static_meshes)} StaticMeshes total')
placed = 0
for i, mesh_path in enumerate(static_meshes[:10]):
    obj = unreal.EditorAssetLibrary.load_asset(mesh_path)
    if obj:
        actor = editor.spawn_actor_from_object(obj, unreal.Vector(i * 1000, 0, 0))
        if actor:
            placed += 1
            unreal.log(f'Placed {mesh_path} at x={i * 1000}')
unreal.log(f'Placement test done: {placed} StaticMeshes placed out of {len(static_meshes)} found')
`;

/**
 * GET /api/test/place-test?projectId=...
 * Queues a minimal UE5 placement script to verify Imported StaticMeshes can be found in subfolders and spawned.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await createServerAuthClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";
    if (!projectId) {
      return NextResponse.json({ error: "projectId query parameter required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: project, error } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await queueUE5Command(projectId, PLACEMENT_TEST_PYTHON, { commandType: "execute" });

    return NextResponse.json({ success: true, message: "Placement test queued" });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
