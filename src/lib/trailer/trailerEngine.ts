/**
 * AI Trailer Maker — generates UE5 Python to place cinematic cameras for Movie Pipeline / Sequencer.
 */

export interface TrailerShot {
  id: string;
  name: string;
  cameraPosition: { x: number; y: number; z: number };
  cameraRotation: { pitch: number; yaw: number; roll: number };
  duration: number;
  cameraMovement: "static" | "dolly_forward" | "dolly_back" | "pan_left" | "pan_right" | "crane_up" | "crane_down" | "orbit";
  fov: number;
}

export interface TrailerPlan {
  title: string;
  shots: TrailerShot[];
  totalDuration: number;
  music: string;
  resolution: "1080p" | "4K";
}

export function generateTrailerCode(plan: TrailerPlan): string {
  const safeTitle = plan.title.replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  let code = `
import unreal

def create_cinematic_trailer():
    editor = unreal.EditorLevelLibrary()
    all_actors = editor.get_all_level_actors()
`;

  plan.shots.forEach((shot, index) => {
    const { cameraPosition: p, cameraRotation: r } = shot;
    code += `
    # Shot ${index + 1}: ${shot.name}
    camera_${index} = editor.spawn_actor_from_class(
        unreal.CineCameraActor,
        unreal.Vector(${p.x}, ${p.y}, ${p.z})
    )
    if camera_${index}:
        camera_${index}.set_actor_rotation(
            unreal.Rotator(${r.pitch}, ${r.yaw}, ${r.roll})
        )
        cine_comp = camera_${index}.get_cine_camera_component()
        if cine_comp:
            cine_comp.set_editor_property("field_of_view", ${shot.fov})
        camera_${index}.set_actor_label("TrailerCam_${index + 1}_${shot.name.replace(/\s/g, "_")}")
`;
    if (shot.cameraMovement !== "static") {
      code += `    # Movement: ${shot.cameraMovement} (animate in Sequencer)\n`;
    }
  });

  const res = plan.resolution === "4K" ? "3840x2160" : "1920x1080";
  code += `
    unreal.log("Cinematic trailer cameras placed! ${plan.shots.length} shots ready.")
    unreal.log("Resolution: ${res}. Use Sequencer to animate camera movements, then Movie Pipeline to render.")

create_cinematic_trailer()
`.trim();

  return code;
}

export type TrailerTemplateKey = "epic_reveal" | "action_montage" | "atmospheric_tour";

function shotId(name: string, i: number): string {
  return `shot-${i}-${name.replace(/\s/g, "-").toLowerCase()}`;
}

export const trailerTemplates: Record<
  TrailerTemplateKey,
  { name: string; description: string; shots: Omit<TrailerShot, "id">[] }
> = {
  epic_reveal: {
    name: "Epic Reveal",
    description: "Wide establishing shot → slow zoom → dramatic reveal of main structure",
    shots: [
      { name: "Wide Establishing", cameraPosition: { x: -5000, y: 0, z: 2000 }, cameraRotation: { pitch: -15, yaw: 0, roll: 0 }, duration: 4, cameraMovement: "static", fov: 90 },
      { name: "Slow Approach", cameraPosition: { x: -3000, y: 500, z: 1000 }, cameraRotation: { pitch: -10, yaw: -10, roll: 0 }, duration: 5, cameraMovement: "dolly_forward", fov: 70 },
      { name: "Low Angle Hero", cameraPosition: { x: -500, y: 0, z: 100 }, cameraRotation: { pitch: -30, yaw: 0, roll: 0 }, duration: 3, cameraMovement: "crane_up", fov: 50 },
      { name: "Dramatic Orbit", cameraPosition: { x: 0, y: -1000, z: 500 }, cameraRotation: { pitch: -10, yaw: 90, roll: 0 }, duration: 6, cameraMovement: "orbit", fov: 60 },
      { name: "Final Wide", cameraPosition: { x: 2000, y: 0, z: 3000 }, cameraRotation: { pitch: -35, yaw: 180, roll: 0 }, duration: 4, cameraMovement: "static", fov: 90 },
    ],
  },
  action_montage: {
    name: "Action Montage",
    description: "Fast cuts between different angles, close-ups, dynamic movements",
    shots: [
      { name: "Quick Pan", cameraPosition: { x: 0, y: -2000, z: 500 }, cameraRotation: { pitch: -5, yaw: 90, roll: 0 }, duration: 2, cameraMovement: "pan_right", fov: 80 },
      { name: "Close Detail", cameraPosition: { x: 0, y: 0, z: 200 }, cameraRotation: { pitch: -45, yaw: 0, roll: 0 }, duration: 1.5, cameraMovement: "static", fov: 40 },
      { name: "Fly Through", cameraPosition: { x: -3000, y: 0, z: 300 }, cameraRotation: { pitch: -5, yaw: 0, roll: 0 }, duration: 3, cameraMovement: "dolly_forward", fov: 100 },
      { name: "Low Sweep", cameraPosition: { x: 500, y: -500, z: 50 }, cameraRotation: { pitch: 5, yaw: 45, roll: 5 }, duration: 2, cameraMovement: "pan_left", fov: 70 },
      { name: "Birds Eye", cameraPosition: { x: 0, y: 0, z: 5000 }, cameraRotation: { pitch: -89, yaw: 0, roll: 0 }, duration: 3, cameraMovement: "crane_down", fov: 60 },
      { name: "Title Card Angle", cameraPosition: { x: -1000, y: 0, z: 800 }, cameraRotation: { pitch: -20, yaw: 0, roll: 0 }, duration: 3, cameraMovement: "static", fov: 50 },
    ],
  },
  atmospheric_tour: {
    name: "Atmospheric Tour",
    description: "Slow, cinematic tour of the environment with moody angles",
    shots: [
      { name: "Misty Morning", cameraPosition: { x: -4000, y: -2000, z: 500 }, cameraRotation: { pitch: -5, yaw: 30, roll: 0 }, duration: 6, cameraMovement: "dolly_forward", fov: 70 },
      { name: "Through the Trees", cameraPosition: { x: -1000, y: 1000, z: 200 }, cameraRotation: { pitch: 0, yaw: -45, roll: 0 }, duration: 5, cameraMovement: "dolly_forward", fov: 60 },
      { name: "Water Reflection", cameraPosition: { x: 500, y: 0, z: 50 }, cameraRotation: { pitch: 10, yaw: 0, roll: 0 }, duration: 4, cameraMovement: "pan_right", fov: 80 },
      { name: "Golden Hour Silhouette", cameraPosition: { x: 2000, y: 0, z: 300 }, cameraRotation: { pitch: -10, yaw: 180, roll: 0 }, duration: 5, cameraMovement: "static", fov: 50 },
    ],
  },
};

export function buildTrailerPlan(
  templateKey: TrailerTemplateKey,
  title: string,
  resolution: "1080p" | "4K"
): TrailerPlan {
  const template = trailerTemplates[templateKey];
  const shots: TrailerShot[] = template.shots.map((s, i) => ({
    ...s,
    id: shotId(s.name, i),
  }));
  const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);
  return {
    title: title || template.name,
    shots,
    totalDuration,
    music: "",
    resolution,
  };
}

/** Parse [TRAILER template_name: description] from message text */
export function parseTrailerTag(text: string): { templateKey: TrailerTemplateKey; description: string } | null {
  const match = text.match(/\[TRAILER\s+(\w+)(?:\s*:\s*([^\n\]]*))?\]/i);
  if (!match) return null;
  const key = match[1].toLowerCase() as string;
  const templateKey =
    key === "epic_reveal" || key === "action_montage" || key === "atmospheric_tour" ? key : "epic_reveal";
  return { templateKey, description: (match[2] || "").trim() };
}
