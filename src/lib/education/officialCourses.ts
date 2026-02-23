export interface OfficialLesson {
  lesson_number: number;
  title: string;
  description: string;
  agent_prompt: string;
  expected_result: string;
  duration_minutes: number;
}

export interface OfficialCourse {
  title: string;
  description: string;
  category: string;
  difficulty: string;
  is_free: boolean;
  duration_minutes: number;
  lessons: OfficialLesson[];
}

export const officialCourses: OfficialCourse[] = [
  {
    title: "Your First UE5 Scene",
    description: "Learn the basics of Unreal Engine 5 by building a simple outdoor scene with Grand Studio AI agents.",
    category: "beginner",
    difficulty: "beginner",
    is_free: true,
    duration_minutes: 30,
    lessons: [
      {
        lesson_number: 1,
        title: "Creating a Ground Plane",
        description: "Learn how to create a basic ground surface in UE5.",
        agent_prompt: "@thomas create a large green plane at position 0,0,0 with scale 100,100,1 using /Engine/BasicShapes/Plane",
        expected_result: "A large flat surface appears in the viewport",
        duration_minutes: 5,
      },
      {
        lesson_number: 2,
        title: "Adding Sky and Sun",
        description: "Learn about SkyAtmosphere and DirectionalLight to create a realistic sky.",
        agent_prompt: "@thomas add a SkyAtmosphere and a DirectionalLight with rotation -50 pitch for a noon sun. Also add a SkyLight for ambient fill.",
        expected_result: "Bright blue sky with sun and realistic lighting",
        duration_minutes: 5,
      },
      {
        lesson_number: 3,
        title: "Placing Objects",
        description: "Learn how to spawn and position 3D objects in the scene.",
        agent_prompt: "@thomas place 5 cubes at different positions on the ground. Make some tall like buildings and some small like boxes.",
        expected_result: "Multiple cubes of different sizes on the ground plane",
        duration_minutes: 5,
      },
      {
        lesson_number: 4,
        title: "Adding Lights",
        description: "Learn about different light types: Point, Spot, and Directional.",
        agent_prompt: "@thomas add 3 point lights with orange color near the cubes, like torches. Set intensity to 5000 and attenuation radius to 500.",
        expected_result: "Warm orange lights illuminating the cubes",
        duration_minutes: 5,
      },
      {
        lesson_number: 5,
        title: "Atmosphere and Fog",
        description: "Learn how fog and post-processing create mood.",
        agent_prompt: "@thomas add ExponentialHeightFog with density 0.01 and add a PostProcessVolume with bloom intensity 1.5",
        expected_result: "Scene has atmospheric depth and soft glow",
        duration_minutes: 5,
      },
      {
        lesson_number: 6,
        title: "Final Touch: Trees",
        description: "Add trees using cylinder trunks and sphere canopies.",
        agent_prompt: "@thomas add 10 trees made of cylinder trunks (scale 0.3,0.3,3) with sphere canopies (scale 2,2,2) at random positions around the scene",
        expected_result: "Trees scattered around the scene making it look like a park",
        duration_minutes: 5,
      },
    ],
  },
  {
    title: "Lighting Masterclass",
    description: "Master UE5 lighting: directional lights, point lights, spot lights, fog, and post-processing for different moods.",
    category: "beginner",
    difficulty: "beginner",
    is_free: true,
    duration_minutes: 20,
    lessons: [
      {
        lesson_number: 1,
        title: "Sunny Day Lighting",
        description: "Create bright, cheerful outdoor lighting.",
        agent_prompt: "@thomas create a scene with: ground plane, SkyAtmosphere, DirectionalLight at -65 pitch (noon), SkyLight intensity 3, VolumetricCloud. Make it look like a bright summer day.",
        expected_result: "Bright, warm scene with blue sky and white clouds",
        duration_minutes: 5,
      },
      {
        lesson_number: 2,
        title: "Golden Hour / Sunset",
        description: "Create warm, cinematic golden hour lighting.",
        agent_prompt: "@thomas change the DirectionalLight to -15 pitch and color to LinearColor(1.0, 0.6, 0.3). Add fog with density 0.02 and inscattering color orange.",
        expected_result: "Beautiful sunset with warm orange light and long shadows",
        duration_minutes: 5,
      },
      {
        lesson_number: 3,
        title: "Night Scene with Moonlight",
        description: "Create a dark night scene with moonlight.",
        agent_prompt: "@thomas set DirectionalLight to intensity 0.5, color blue LinearColor(0.4, 0.5, 0.8), pitch -20. Add heavy fog density 0.05. Add PostProcessVolume with exposure bias -2.",
        expected_result: "Dark moody night with blue moonlight and heavy fog",
        duration_minutes: 5,
      },
      {
        lesson_number: 4,
        title: "Interior Torch Lighting",
        description: "Create atmospheric indoor lighting with torches.",
        agent_prompt: "@thomas delete the DirectionalLight. Add 4 PointLights with orange color LinearColor(1.0, 0.4, 0.1), intensity 3000, attenuation 600 at corners of the scene. Add PostProcessVolume with bloom 2.5 and AO 2.0.",
        expected_result: "Dark interior with warm flickering torch-like lights",
        duration_minutes: 5,
      },
    ],
  },
  {
    title: "Building a Medieval Castle",
    description: "Build a complete medieval castle step by step using basic shapes, learning architecture and composition.",
    category: "intermediate",
    difficulty: "intermediate",
    is_free: true,
    duration_minutes: 45,
    lessons: [
      {
        lesson_number: 1,
        title: "Castle Foundation",
        description: "Create the castle base and ground.",
        agent_prompt: "@thomas create a large ground plane (scale 300,300,1). Create a raised platform for the castle: a cube at position (0,0,50) with scale (15,15,1) as the castle floor.",
        expected_result: "A raised stone platform for the castle",
        duration_minutes: 7,
      },
      {
        lesson_number: 2,
        title: "Castle Walls",
        description: "Build four walls around the castle.",
        agent_prompt: "@thomas build 4 castle walls using cubes: North wall at (0,750,300) scale (15,0.5,6), South wall at (0,-750,300) scale (15,0.5,6), East wall at (750,0,300) scale (0.5,15,6), West wall at (-750,0,300) scale (0.5,15,6).",
        expected_result: "Four walls forming a castle perimeter",
        duration_minutes: 7,
      },
      {
        lesson_number: 3,
        title: "Corner Towers",
        description: "Add four cylindrical towers at each corner.",
        agent_prompt: "@thomas add 4 cylinder towers at corners: (750,750), (-750,750), (750,-750), (-750,-750). Each tower: cylinder scale (3,3,10) at Z=500. Add cone roofs on top at Z=1100 with scale (4,4,2).",
        expected_result: "Four tall towers with pointed roofs at castle corners",
        duration_minutes: 7,
      },
      {
        lesson_number: 4,
        title: "Main Gate",
        description: "Create the castle entrance gate.",
        agent_prompt: "@thomas in the south wall, create a gate: two pillar cubes at (-150,-750,200) and (150,-750,200) scale (1,1,4). Add a top beam cube at (0,-750,450) scale (3,1,0.5). Delete or shrink the south wall section between the pillars.",
        expected_result: "A castle gate opening in the south wall",
        duration_minutes: 7,
      },
      {
        lesson_number: 5,
        title: "Central Keep",
        description: "Build the main castle building.",
        agent_prompt: "@thomas build the central keep: a large cube at (0,0,400) scale (5,5,8). Add a smaller cube on top at (0,0,900) scale (3,3,3) as the upper chamber. Add a flag pole: thin cylinder at (0,0,1150) scale (0.05,0.05,3).",
        expected_result: "A tall central building (keep) dominating the castle",
        duration_minutes: 7,
      },
      {
        lesson_number: 6,
        title: "Lighting and Atmosphere",
        description: "Add medieval lighting to complete the castle.",
        agent_prompt: "@thomas add: SkyAtmosphere, DirectionalLight at pitch -35 with warm color (1.0, 0.85, 0.7) intensity 6, SkyLight, VolumetricCloud, ExponentialHeightFog density 0.015. Add 6 orange PointLights (intensity 5000) around the castle walls as torches. PostProcessVolume with bloom 1.5 and exposure -0.5.",
        expected_result: "Complete medieval castle with atmospheric golden hour lighting",
        duration_minutes: 10,
      },
    ],
  },
];
