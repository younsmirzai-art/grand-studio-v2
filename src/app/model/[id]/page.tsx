import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogDetail } from "@/lib/catalog/detail";
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
  const detail = await getCatalogDetail(decodeURIComponent(id));

  if (!detail) {
    return { title: "Asset not found" };
  }

  const description =
    detail.description ||
    `Download ${detail.name} — ${detail.license} ${detail.kind} from ${detail.source}.`;

  return {
    title: detail.name,
    description,
    openGraph: {
      title: detail.name,
      description,
      images: detail.thumbnail ? [detail.thumbnail] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: detail.name,
      description,
      images: detail.thumbnail ? [detail.thumbnail] : [],
    },
  };
}

export default async function ModelPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await getCatalogDetail(decodeURIComponent(id));

  if (!detail) {
    notFound();
  }

  const sketchfabUid =
    detail.source === "sketchfab" ? detail.rawId : undefined;

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <ModelHero
          name={detail.name}
          modelId={detail.id}
          modelThumbnail={detail.thumbnail}
          categories={detail.categories}
          tags={detail.tags}
        />

        <div className="grid lg:grid-cols-[1fr_400px] gap-6 mb-8">
          <div>
            <ModelViewer
              modelUrl={detail.previewModelUrl}
              embedUrl={detail.embedUrl}
              posterUrl={detail.thumbnail}
              modelName={detail.name}
            />
            {detail.description ? (
              <p className="mt-4 text-sm text-white/55 leading-relaxed max-w-3xl">
                {detail.description}
              </p>
            ) : null}
          </div>

          <div className="space-y-4">
            <DownloadPanel
              files={detail.files}
              extraDownloads={detail.extraDownloads}
              sketchfabUid={sketchfabUid}
              licenseLabel={
                detail.source === "sketchfab"
                  ? `${detail.license} — Sketchfab terms apply`
                  : "CC0 — free for any use"
              }
              modelName={detail.name}
              modelId={detail.id}
              posterUrl={detail.thumbnail}
              categories={detail.categories}
              tags={detail.tags}
            />
            <ModelMetadata
              downloads={detail.downloads}
              license={detail.license}
              source={detail.source}
              author={detail.author}
              kind={detail.kind}
            />
          </div>
        </div>

        <Suspense
          fallback={
            <div className="mt-12 py-8 text-center text-white/40 text-sm">
              Loading similar assets...
            </div>
          }
        >
          <SimilarModels
            currentId={detail.id}
            categories={detail.categories}
            kind={detail.kind}
          />
        </Suspense>
      </div>
    </div>
  );
}
