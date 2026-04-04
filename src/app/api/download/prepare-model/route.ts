import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import { checkUsageLimit, recordUsage } from "@/lib/usage/usageTracker";
import {
  preparePolyHavenModelZip,
  prepareSketchfabDownload,
  recordUserDownloadRow,
} from "@/lib/download/prepareModelPackage";

const POLY_LIMIT = "polyhaven_import";
const SF_LIMIT = "sketchfab_import";

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerAuthClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      source?: string;
      assetId?: string;
      name?: string;
    };
    const source = body.source;
    const assetId = typeof body.assetId === "string" ? body.assetId.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!assetId) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }
    if (source !== "polyhaven" && source !== "sketchfab") {
      return NextResponse.json({ error: "source must be polyhaven or sketchfab" }, { status: 400 });
    }

    const displayName = name || assetId;

    if (source === "polyhaven") {
      const limitCheck = await checkUsageLimit(user.id, POLY_LIMIT);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { error: "You've reached your daily model download limit. Upgrade to Pro for unlimited downloads!", limitReached: true },
          { status: 403 }
        );
      }
      const prepared = await preparePolyHavenModelZip({
        assetId,
        displayName,
        userId: user.id,
      });
      await recordUsage(user.id, POLY_LIMIT);
      await recordUserDownloadRow({
        userId: user.id,
        assetName: displayName,
        assetSource: "polyhaven",
        assetId,
        downloadUrl: prepared.downloadUrl,
        fileSize: prepared.fileSize,
        fileSizeBytes: prepared.fileSizeBytes,
      });
      return NextResponse.json({
        downloadUrl: prepared.downloadUrl,
        fileName: prepared.fileName,
        fileSize: prepared.fileSize,
        formatLabel: prepared.formatLabel,
      });
    }

    const limitCheck = await checkUsageLimit(user.id, SF_LIMIT);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "You've reached your daily community download limit. Upgrade to Pro for unlimited downloads!", limitReached: true },
        { status: 403 }
      );
    }
    const prepared = await prepareSketchfabDownload({ assetId, displayName });
    await recordUsage(user.id, SF_LIMIT);
    await recordUserDownloadRow({
      userId: user.id,
      assetName: displayName,
      assetSource: "sketchfab",
      assetId,
      downloadUrl: prepared.downloadUrl,
      fileSize: prepared.fileSize,
      fileSizeBytes: prepared.fileSizeBytes,
    });
    return NextResponse.json({
      downloadUrl: prepared.downloadUrl,
      fileName: prepared.fileName,
      fileSize: prepared.fileSize,
      formatLabel: prepared.formatLabel,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[download/prepare-model]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
