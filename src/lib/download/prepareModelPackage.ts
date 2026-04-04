import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { resolvePolyHavenModelDownloadUrl, pickPolyHavenDiffuseUrl } from "@/lib/polyhaven/client";
import { getSketchfabDownloadPick } from "@/lib/sketchfab/client";
import { formatFileSizeBytes } from "@/lib/download/formatFileSize";

const USER_AGENT = "GrandStudio/1.0 (contact@grandstudio.dev)";
const STORAGE_BUCKET = "polyhaven-assets";
const ZIP_PREFIX = "workspace-packages";

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

function slugFileName(name: string, ext: string): string {
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

export type PreparePolyHavenResult = {
  downloadUrl: string;
  fileName: string;
  fileSize: string;
  fileSizeBytes: number;
  formatLabel: string;
};

export type PrepareSketchfabResult = {
  downloadUrl: string;
  fileName: string;
  fileSize: string;
  fileSizeBytes: number;
  formatLabel: string;
};

export async function preparePolyHavenModelZip(params: {
  assetId: string;
  displayName: string;
  userId: string;
}): Promise<PreparePolyHavenResult> {
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
  const storagePath = `${ZIP_PREFIX}/${params.userId}/${Date.now()}_${fileName}`;

  const supabase = serviceSupabase();
  const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, zipBuf, {
    contentType: "application/zip",
    upsert: true,
  });
  if (upErr) throw new Error(upErr.message);

  const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  const downloadUrl = pub.publicUrl;

  return {
    downloadUrl,
    fileName,
    fileSize: formatFileSizeBytes(fileSizeBytes),
    fileSizeBytes,
    formatLabel: diffuseUrl ? "FBX + textures (ZIP)" : "FBX (ZIP)",
  };
}

export async function prepareSketchfabDownload(params: {
  assetId: string;
  displayName: string;
}): Promise<PrepareSketchfabResult> {
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) throw new Error("SKETCHFAB_API_TOKEN not configured");

  const pick = await getSketchfabDownloadPick(params.assetId, token);
  if (!pick) throw new Error("Could not get Sketchfab download. The model may not be downloadable.");

  const fileName = pick.fileNameHint || slugFileName(params.displayName || params.assetId, "zip");
  const fileSizeBytes = pick.sizeBytes ?? 0;
  const low = pick.url.toLowerCase();
  const formatLabel = low.includes(".zip")
    ? "Archive (ZIP)"
    : low.includes(".glb")
      ? "GLB"
      : "Download";

  return {
    downloadUrl: pick.url,
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
  downloadUrl: string;
  fileSize: string;
  fileSizeBytes: number;
}): Promise<void> {
  const supabase = serviceSupabase();
  const { error } = await supabase.from("user_downloads").insert({
    user_id: params.userId,
    asset_name: params.assetName,
    asset_source: params.assetSource,
    asset_id: params.assetId,
    download_url: params.downloadUrl,
    file_size: params.fileSize,
    file_size_bytes: params.fileSizeBytes > 0 ? params.fileSizeBytes : null,
  });
  if (error) console.warn("[user_downloads] insert failed:", error.message);
}
