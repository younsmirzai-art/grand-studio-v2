import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServerClient } from "@/lib/supabase/server";
import { queueUE5Command } from "@/lib/ue5/commands";

const PLACEMENT_TEST_PYTHON = `import unreal
editor = unreal.EditorLevelLibrary
import_dir = '/Game/GrandStudio/Imported'
all_assets = unreal.EditorAssetLibrary.list_assets(import_dir, recursive=True)
unreal.log(f'Found {len(all_assets)} imported assets')
placed = 0
for i, asset_path in enumerate(all_assets[:5]):
    clean = asset_path.split('.')[0]
    obj = unreal.EditorAssetLibrary.load_asset(clean)
    if obj:
        actor = editor.spawn_actor_from_object(obj, unreal.Vector(i * 800, 0, 0))
        if actor:
            placed += 1
            unreal.log(f'Placed {clean} at x={i * 800}')
unreal.log(f'Placement test done: {placed} assets placed')
`;

/**
 * GET /api/test/place-test?projectId=...
 * Queues a minimal UE5 placement script to verify Imported assets can be spawned in the level.
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
