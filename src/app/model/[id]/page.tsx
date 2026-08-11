import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPolyHavenAssetInfo,
  getPolyHavenAssetFiles,
  pickPolyHavenFormatEntry,
  getThumbnailUrl,
} from "@/lib/polyhaven/client";
import { ModelViewer } from "@/components/model/ModelViewer";
import { DownloadPanel } from "@/components/model/DownloadPanel";
import { ModelMetadata } from "@/components/model/ModelMetadata";
import { SimilarModels } from "@/components/model/SimilarModels";
import { ModelHero } from "@/components/model/ModelHero";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const info = await getPolyHavenAssetInfo(id);

  if (!info) {
    return { title: "Model not found" };
  }

  const description =
    info.description ||
    `Download ${info.name} — free CC0 3D model from Poly Haven. ${info.categories
      .slice(0, 3)
      .join(", ")}. ${info.download_count.toLocaleString()} downloads.`;
  const posterUrl = getThumbnailUrl(id, 1200);

  return {
    title: info.name,
    description,
    openGraph: {
      title: info.name,
      description,
      images: [posterUrl],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: info.name,
      description,
      images: [posterUrl],
    },
  };
}

export default async function ModelPage({ params }: PageProps) {
  const { id } = await params;

  const [info, files] = await Promise.all([
    getPolyHavenAssetInfo(id),
    getPolyHavenAssetFiles(id),
  ]);

  if (!info) {
    notFound();
  }

  const hasGltf = pickPolyHavenFormatEntry(files, "gltf", "1k") !== null;
  const modelUrl = hasGltf ? `/api/polyhaven/gltf-preview/${encodeURIComponent(id)}` : undefined;
  const posterUrl = getThumbnailUrl(id, 1200);

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <ModelHero
          name={info.name}
          modelId={id}
          modelThumbnail={posterUrl}
          categories={info.categories}
          tags={info.tags}
        />

        <div className="grid lg:grid-cols-[1fr_400px] gap-6 mb-8">
          <div>
            <ModelViewer
              modelUrl={modelUrl}
              posterUrl={posterUrl}
              modelName={info.name}
            />
            {info.description ? (
              <p className="mt-4 text-sm text-white/55 leading-relaxed max-w-3xl">
                {info.description}
              </p>
            ) : null}
          </div>

          <div className="space-y-4">
            <DownloadPanel
              files={files}
              modelName={info.name}
              modelId={id}
              posterUrl={posterUrl}
              categories={info.categories}
              tags={info.tags}
            />
            <ModelMetadata info={info} />
          </div>
        </div>

        <Suspense
          fallback={
            <div className="mt-12 py-8 text-center text-white/40 text-sm">
              Loading similar models...
            </div>
          }
        >
          <SimilarModels currentId={id} categories={info.categories} />
        </Suspense>
      </div>
    </div>
  );
}
