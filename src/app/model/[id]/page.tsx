import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Check, ExternalLink } from "lucide-react";
import { getPolyHavenAsset } from "@/lib/polyhaven/client";

interface ModelDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ModelDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const model = await getPolyHavenAsset(id);
  if (!model) return { title: "Model not found" };
  return {
    title: model.name,
    description: `Download ${model.name} from ${model.source} on Grand Studio.`,
  };
}

export default async function ModelDetailPage({ params }: ModelDetailPageProps) {
  const { id } = await params;
  const model = await getPolyHavenAsset(id);
  if (!model) notFound();

  return (
    <div className="pt-28 pb-24 min-h-screen">
      <div className="max-w-7xl mx-auto px-6">
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to browse
        </Link>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14">
          <div className="gs-mockup-frame relative aspect-square bg-black/40">
            <Image
              src={model.thumbnail}
              alt={model.name}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              unoptimized
              priority
            />
          </div>

          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              {model.isFree && (
                <span className="px-2.5 py-1 rounded text-[11px] font-semibold uppercase bg-green-500/20 text-green-300 border border-green-500/30">
                  Free
                </span>
              )}
              <span className="px-2.5 py-1 rounded text-[11px] font-medium bg-white/5 border border-white/10 text-white/60">
                {model.source}
              </span>
              {model.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat}
                  className="px-2.5 py-1 rounded text-[11px] capitalize bg-white/5 border border-white/10 text-white/50"
                >
                  {cat}
                </span>
              ))}
            </div>

            <h1 className="gs-heading-lg mb-3">{model.name}</h1>
            <p className="text-white/55 mb-8 leading-relaxed">
              High-quality 3D asset from {model.source}. Available for download
              through Grand Studio with clear licensing and format options.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-8">
              <div className="gs-feature-card p-4">
                <div className="text-xs text-white/40 mb-1">Downloads</div>
                <div className="text-lg font-display font-semibold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-cyan-400" />
                  {model.downloads.toLocaleString()}
                </div>
              </div>
              <div className="gs-feature-card p-4">
                <div className="text-xs text-white/40 mb-1">License</div>
                <div className="text-lg font-display font-semibold text-white flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-400" />
                  CC0 / Free
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-white text-black font-semibold hover:bg-white/90 transition-colors"
              >
                Sign in to download
              </Link>
              <a
                href={`https://polyhaven.com/a/${model.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
              >
                View on Poly Haven
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {model.tags.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-white/35 mb-2">
                  Tags
                </div>
                <div className="flex flex-wrap gap-2">
                  {model.tags.slice(0, 12).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-md text-xs bg-white/[0.03] border border-white/8 text-white/45"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
