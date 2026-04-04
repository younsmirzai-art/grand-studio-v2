import { NextResponse } from "next/server";

/** Remote command queue was tied to the removed local relay. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Queuing Python to Unreal via the website relay is no longer supported. Use the Grand Studio Commander plugin to run scripts, or download models from the workspace 3D Library and import them in the Content Browser.",
      code: "RELAY_REMOVED",
    },
    { status: 410 }
  );
}
