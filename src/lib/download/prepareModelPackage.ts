import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { resolvePolyHavenModelDownloadUrl, pickPolyHavenDiffuseUrl } from "@/lib/polyhaven/client";
import { getSketchfabDownloadPick } from "@/lib/sketchfab/client";
import { formatFileSizeBytes } from "@/lib/download/formatFileSize";

const USER_AGENT = "GrandStudio/1.0 (contact@grandstudio.dev)";

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

export function slugFileName(name: string, ext: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return `${base || "model"}.${ext}`;
}

async function fetchBinary(url: string): Promise<{ buf: Buffer; contentType: string | null }> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch asset (${res.status})`);
  const ab = await res.arrayBuffer();
  return { buf: Buffer.from(ab), contentType: res.headers.get("content-type") };
}

function diffuseExtFromUrl(url: string): string {
  const path = url.split("?")[0].split("#")[0].toLowerCase();
  if (path.endsWith(".png")) return "png";
  if (path.endsWith(".webp")) return "webp";
  if (path.endsWith(".exr")) return "exr";
  return "jpg";
}

export type PreparedModelStream = {
  body: Buffer;
  contentType: string;
  fileName: string;
  fileSize: string;
  fileSizeBytes: number;
  formatLabel: string;
};

export async function preparePolyHavenModelZip(params: {
  assetId: string;
  displayName: string;
}): Promise<PreparedModelStream> {
  const filesJson = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(params.assetId)}`, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  }).then((r) => (r.ok ? r.json() : null));

  if (!filesJson || typeof filesJson !== "object") {
    throw new Error("Could not load Poly Haven file list for this asset");
  }

  const resolved = resolvePolyHavenModelDownloadUrl(filesJson as Record<string, unknown>, "1k");
  if (!resolved?.url) throw new Error("No FBX download found for this Poly Haven asset");

  const diffuseUrl = resolved.diffuseUrl ?? pickPolyHavenDiffuseUrl(filesJson as Record<string, unknown>, "1k");

  const zip = new JSZip();
  const fbx = await fetchBinary(resolved.url);
  zip.file("model.fbx", fbx.buf);

  if (diffuseUrl) {
    const tex = await fetchBinary(diffuseUrl);
    const ext = diffuseExtFromUrl(diffuseUrl);
    zip.folder("textures")?.file(`diffuse.${ext}`, tex.buf);
  }

  const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const fileSizeBytes = zipBuf.length;
  const fileName = slugFileName(params.displayName || params.assetId, "zip");

  return {
    body: zipBuf,
    contentType: "application/zip",
    fileName,
    fileSize: formatFileSizeBytes(fileSizeBytes),
    fileSizeBytes,
    formatLabel: diffuseUrl ? "FBX + textures (ZIP)" : "FBX (ZIP)",
  };
}

function contentTypeForSketchfabFileName(fileName: string): string {
  const low = fileName.toLowerCase();
  if (low.endsWith(".zip")) return "application/zip";
  if (low.endsWith(".glb")) return "model/gltf-binary";
  if (low.endsWith(".gltf")) return "model/gltf+json";
  return "application/octet-stream";
}

export async function prepareSketchfabModelBinary(params: {
  assetId: string;
  displayName: string;
}): Promise<PreparedModelStream> {
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) throw new Error("SKETCHFAB_API_TOKEN not configured");

  const pick = await getSketchfabDownloadPick(params.assetId, token);
  if (!pick) throw new Error("Could not get Sketchfab download. The model may not be downloadable.");

  const res = await fetch(pick.url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Sketchfab file fetch failed (${res.status})`);

  const ab = await res.arrayBuffer();
  const body = Buffer.from(ab);
  const fileSizeBytes = body.length;
  const headerCt = res.headers.get("content-type");
  const hint = pick.fileNameHint || `${params.assetId}.zip`;
  const extMatch = hint.match(/\.([^.]+)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : "zip";
  const fileName = slugFileName(params.displayName || params.assetId, ext);
  const contentType =
    headerCt && !headerCt.includes("text/html") && !headerCt.includes("application/json")
      ? headerCt.split(";")[0].trim()
      : contentTypeForSketchfabFileName(fileName);

  const low = fileName.toLowerCase();
  const formatLabel = low.includes(".zip")
    ? "Archive (ZIP)"
    : low.includes(".glb")
      ? "GLB"
      : low.includes(".gltf")
        ? "glTF"
        : "Download";

  return {
    body,
    contentType,
    fileName,
    fileSize: fileSizeBytes > 0 ? formatFileSizeBytes(fileSizeBytes) : "—",
    fileSizeBytes,
    formatLabel,
  };
}

export async function recordUserDownloadRow(params: {
  userId: string;
  assetName: string;
  assetSource: "polyhaven" | "sketchfab";
  assetId: string;
  downloadUrl?: string | null;
  fileSize: string;
  fileSizeBytes: number;
}): Promise<void> {
  const supabase = serviceSupabase();
  const { error } = await supabase.from("user_downloads").insert({
    user_id: params.userId,
    asset_name: params.assetName,
    asset_source: params.assetSource,
    asset_id: params.assetId,
    download_url: params.downloadUrl ?? null,
    file_size: params.fileSize,
    file_size_bytes: params.fileSizeBytes > 0 ? params.fileSizeBytes : null,
  });
  if (error) console.warn("[user_downloads] insert failed:", error.message);
}
