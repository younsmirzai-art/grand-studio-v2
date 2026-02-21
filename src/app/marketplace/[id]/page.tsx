"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Crown, Star, Loader2, Rocket, Code, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GameTemplateDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail_url: string | null;
  tags: string[];
  is_free: boolean;
  is_official: boolean;
  download_count: number;
  rating: number;
  rating_count: number;
  difficulty: string;
  estimated_build_time: number;
  agents_used: string[];
  game_dna_preset: string | null;
  ue5_code: string;
  template_data: Record<string, unknown>;
  created_at: string;
}

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [template, setTemplate] = useState<GameTemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [using, setUsing] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const supabase = getClient();
    supabase
      .from("game_templates")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setTemplate(null);
        } else {
          setTemplate(data as GameTemplateDetail);
        }
        setLoading(false);
      });
  }, [id]);

  const handleUseTemplate = async () => {
    if (!template || using) return;
    setUsing(true);
    try {
      const res = await fetch("/api/templates/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      });
      const data = await res.json();
      if (res.ok && data.projectId) {
        toast.success("Project created! Opening project…");
        router.push(`/project/${data.projectId}`);
      } else {
        toast.error(data.error ?? "Failed to use template");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUsing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-boss-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-boss-bg flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-text-muted">Template not found.</p>
        <Link href="/marketplace">
          <Button variant="outline">Back to Marketplace</Button>
        </Link>
      </div>
    );
  }

  const rating = template.rating_count > 0 ? template.rating : null;

  return (
    <div className="min-h-screen bg-boss-bg">
      <nav className="sticky top-0 z-40 border-b border-boss-border bg-boss-surface/95 glass-strong">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/marketplace" className="flex items-center gap-2 text-text-muted hover:text-text-primary">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Marketplace</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 text-text-primary">
            <Crown className="w-4 h-4 text-gold" />
            <span className="font-bold text-sm">Grand Studio</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="rounded-2xl border border-boss-border bg-boss-card overflow-hidden">
          <div className="aspect-video bg-boss-surface flex items-center justify-center text-6xl">
            {template.thumbnail_url ? (
              <img src={template.thumbnail_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="opacity-50">
                {template.category === "medieval" && "🏰"}
                {template.category === "scifi" && "🚀"}
                {template.category === "horror" && "👻"}
                {template.category === "nature" && "🏝️"}
                {template.category === "modern" && "🏙️"}
                {!["medieval", "scifi", "horror", "nature", "modern"].includes(template.category) && "🎮"}
              </span>
            )}
          </div>
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-text-primary">{template.name}</h1>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {template.is_official && (
                    <span className="text-xs px-2 py-0.5 rounded bg-gold/20 text-gold">Official</span>
                  )}
                  {rating != null && (
                    <span className="text-sm text-text-secondary flex items-center gap-1">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      {rating.toFixed(1)} ({template.rating_count} reviews)
                    </span>
                  )}
                  <span className="text-sm text-text-muted">
                    {template.difficulty} · ~{template.estimated_build_time} min
                  </span>
                  <span className="text-sm text-agent-green font-medium">{template.is_free ? "FREE" : ""}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleUseTemplate}
                  disabled={using}
                  className="bg-agent-green hover:bg-agent-green/90 text-white gap-2"
                >
                  {using ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  Use This Template
                </Button>
                <Button
                  variant="outline"
                  className="border-boss-border text-text-secondary gap-2"
                  onClick={() => setCodeOpen(true)}
                >
                  <Code className="w-4 h-4" />
                  Preview Code
                </Button>
              </div>
            </div>

            <p className="text-text-muted mt-4 leading-relaxed">{template.description}</p>

            {template.tags && template.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-1 rounded-md bg-boss-surface border border-boss-border text-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-boss-border grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-text-muted">Agents used</p>
                <p className="text-text-primary capitalize mt-0.5">
                  {template.agents_used && template.agents_used.length > 0
                    ? template.agents_used.join(", ")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Game DNA preset</p>
                <p className="text-text-primary mt-0.5">{template.game_dna_preset ?? "—"}</p>
              </div>
              <div>
                <p className="text-text-muted">Downloads</p>
                <p className="text-text-primary mt-0.5">{template.download_count ?? 0}</p>
              </div>
              {template.template_data && typeof template.template_data === "object" && (
                <div>
                  <p className="text-text-muted">Scene info</p>
                  <p className="text-text-primary mt-0.5">
                    {(template.template_data as { actors_count?: number }).actors_count ?? "—"} actors,{" "}
                    {(template.template_data as { lights_count?: number }).lights_count ?? "—"} lights
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Dialog open={codeOpen} onOpenChange={setCodeOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] bg-boss-card border-boss-border overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-text-primary">UE5 Python code</DialogTitle>
          </DialogHeader>
          <pre className="flex-1 overflow-auto p-4 rounded-lg bg-boss-bg border border-boss-border text-xs text-text-secondary font-mono whitespace-pre-wrap">
            {template.ue5_code}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
