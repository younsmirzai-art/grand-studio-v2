import { NextResponse } from "next/server";
import {
  getPolyHavenAssetFiles,
  pickPolyHavenFormatEntry,
} from "@/lib/polyhaven/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type GltfJson = {
  buffers?: Array<{ uri?: string; [key: string]: unknown }>;
  images?: Array<{ uri?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

function resolveIncludeUrl(
  uri: string,
  include: Record<string, { url: string }>,
  gltfUrl: string
): string {
  if (/^https?:\/\//i.test(uri)) return uri;
  if (include[uri]?.url) return include[uri].url;

  const fileName = uri.split("/").pop();
  if (fileName) {
    for (const [key, value] of Object.entries(include)) {
      if (key === uri || key.endsWith(`/${fileName}`) || key.endsWith(fileName)) {
        return value.url;
      }
    }
  }

  try {
    return new URL(uri, gltfUrl).toString();
  } catch {
    return uri;
  }
}

/**
 * Serves a rewritten Poly Haven GLTF with absolute buffer/image URLs.
 * Relative texture paths 404 on dl.polyhaven.org; includes map has the real URLs.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid asset id" }, { status: 400 });
  }

  try {
    const files = await getPolyHavenAssetFiles(id);
    const picked = pickPolyHavenFormatEntry(files, "gltf", "1k");
    if (!picked) {
      return NextResponse.json({ error: "No GLTF available" }, { status: 404 });
    }

    const gltfRes = await fetch(picked.entry.url, {
      headers: { "User-Agent": "GrandStudio/1.0 (contact@grandstudio.dev)" },
      next: { revalidate: 3600 },
    });
    if (!gltfRes.ok) {
      return NextResponse.json(
        { error: `Upstream GLTF fetch failed (${gltfRes.status})` },
        { status: 502 }
      );
    }

    const gltf = (await gltfRes.json()) as GltfJson;
    const include = picked.entry.include ?? {};

    if (Array.isArray(gltf.buffers)) {
      gltf.buffers = gltf.buffers.map((buffer) => {
        if (!buffer.uri) return buffer;
        return {
          ...buffer,
          uri: resolveIncludeUrl(buffer.uri, include, picked.entry.url),
        };
      });
    }

    if (Array.isArray(gltf.images)) {
      gltf.images = gltf.images.map((image) => {
        if (!image.uri) return image;
        return {
          ...image,
          uri: resolveIncludeUrl(image.uri, include, picked.entry.url),
        };
      });
    }

    return NextResponse.json(gltf, {
      headers: {
        "Content-Type": "model/gltf+json",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[gltf-preview] error:", error);
    return NextResponse.json({ error: "Failed to build preview" }, { status: 500 });
  }
}
