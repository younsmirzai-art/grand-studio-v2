import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an expert UE5 environment artist. Analyze images and recreate them in Unreal Engine 5 using Python code.

When you see an image, you must:
1. Describe what you see in detail (structures, colors, lighting, atmosphere, objects)
2. Break it down into UE5 elements:
   - Basic shapes (cubes, cylinders, spheres, cones, planes from /Engine/BasicShapes/)
   - Lights (directional, point, spot, rect)
   - Atmosphere (sky, fog, clouds, post-process)
   - Layout (positions, scales, rotations)
3. Write COMPLETE Python code that recreates the scene
4. Use ONLY built-in UE5 features, no external assets
5. Use realistic scale (1 unit = 1 cm in UE5)
6. Set material colors using LinearColor where possible

Rules:
- Buildings: Use scaled cubes for walls, cylinders for towers/columns
- Trees: Cylinder trunk (scale 0.3, 0.3, 3) + Sphere canopy (scale 2, 2, 2)
- Ground: Scaled Plane mesh
- Water: Blue-tinted plane at low height
- Rocks: Scaled and rotated spheres/cubes
- Always add SkyAtmosphere, DirectionalLight, SkyLight
- Match the lighting mood of the reference image
- Add ExponentialHeightFog if the image has atmospheric depth
- Position camera similar to the reference image angle

Output format:
ANALYSIS:
[Your detailed description of the image]

ELEMENTS:
[List of UE5 elements needed]

CODE:
\`\`\`python
[Complete UE5 Python code]
\`\`\``;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const instructions = (formData.get("instructions") as string) || "";

    if (!image || !projectId) {
      return NextResponse.json(
        { error: "Missing image or projectId" },
        { status: 400 }
      );
    }

    const bytes = await image.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = image.type || "image/png";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const userContent: { type: string; image_url?: { url: string }; text?: string }[] = [
      {
        type: "image_url",
        image_url: { url: dataUrl },
      },
      {
        type: "text",
        text: instructions
          ? `Recreate this image in UE5. Additional instructions: ${instructions}`
          : "Recreate this image in UE5 as accurately as possible using basic shapes and built-in features.",
      },
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://grand-studio-v2.vercel.app",
        "X-Title": "Grand Studio v2",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: `OpenRouter error: ${err}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content as string) ?? "";

    const analysisMatch = content.match(/ANALYSIS:\s*([\s\S]*?)(?=ELEMENTS:|CODE:|$)/i);
    const elementsMatch = content.match(/ELEMENTS:\s*([\s\S]*?)(?=CODE:|$)/i);
    const codeMatch = content.match(/```python\s*\n?([\s\S]*?)```/);

    return NextResponse.json({
      analysis: analysisMatch ? analysisMatch[1].trim() : content,
      elements: elementsMatch ? elementsMatch[1].trim() : "",
      code: codeMatch ? codeMatch[1].trim() : null,
      fullResponse: content,
    });
  } catch (error) {
    console.error("Image analyze error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
