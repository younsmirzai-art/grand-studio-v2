"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Search, Star, Loader2, Store, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export interface GameTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail_url: string | null;
  tags: string[];
  is_free: boolean;
  is_featured: boolean;
  is_official: boolean;
  download_count: number;
  rating: number;
  rating_count: number;
  difficulty: string;
  estimated_build_time: number;
  agents_used: string[];
  created_at: string;
}

const CATEGORIES = [
  "all",
  "medieval",
  "scifi",
  "horror",
  "nature",
  "modern",
  "general",
];

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  medieval: "Medieval",
  scifi: "Sci-Fi",
  horror: "Horror",
  nature: "Nature",
  modern: "Modern",
  general: "General",
};

export default function MarketplacePage() {
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const supabase = getClient();
    supabase
      .from("game_templates")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("download_count", { ascending: false })
      .then(({ data }) => {
        setTemplates((data ?? []) as GameTemplate[]);
        setLoading(false);
      });
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/templates/seed", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message ?? "Templates seeded");
        const supabase = getClient();
        const { data: list } = await supabase
          .from("game_templates")
          .select("*")
          .order("is_featured", { ascending: false })
          .order("download_count", { ascending: false });
        setTemplates((list ?? []) as GameTemplate[]);
      } else {
        toast.error(data.error ?? "Seed failed");
      }
    } catch {
      toast.error("Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const filtered = templates.filter((t) => {
    const matchSearch =
      !search.trim() ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase())));
    const matchCategory = category === "all" || t.category === category;
    return matchSearch && matchCategory;
  });

  const featured = filtered.filter((t) => t.is_featured);
  const rest = filtered.filter((t) => !t.is_featured);

  return (
    <div className="min-h-screen bg-boss-bg">
      <nav className="sticky top-0 z-40 border-b border-boss-border bg-boss-surface/95 glass-strong">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-primary hover:opacity-90">
            <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Crown className="w-4 h-4 text-gold" />
            </div>
            <span className="font-bold text-sm">Grand Studio</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                Dashboard
              </Button>
            </Link>
            <Button
              onClick={handleSeed}
              disabled={seeding}
              variant="outline"
              size="sm"
              className="border-boss-border text-text-secondary"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {seeding ? "Seeding…" : "Load official templates"}
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Store className="w-7 h-7 text-gold" />
              Game Templates Marketplace
            </h1>
            <p className="text-text-muted text-sm mt-1">
              Pre-built game worlds. Use one and customize in your project.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-56 bg-boss-card border-boss-border text-text-primary placeholder:text-text-muted"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 rounded-md border border-boss-border bg-boss-card text-text-primary text-sm px-3"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c] ?? c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-boss-border bg-boss-card/50">
            <p className="text-text-muted mb-4">
              {templates.length === 0
                ? "No templates yet. Click “Load official templates” to add 5 official game templates."
                : "No templates match your filters."}
            </p>
            {templates.length === 0 && (
              <Button onClick={handleSeed} disabled={seeding} className="bg-gold hover:bg-gold/90 text-boss-bg">
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load official templates"}
              </Button>
            )}
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <section className="mb-10">
                <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Star className="w-4 h-4 text-gold" />
                  Featured
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {featured.map((t) => (
                    <TemplateCard key={t.id} template={t} />
                  ))}
                </div>
              </section>
            )}
            <section>
              {rest.length > 0 && (
                <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
                  {featured.length > 0 ? "More templates" : "Templates"}
                </h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {rest.map((t) => (
                  <TemplateCard key={t.id} template={t} />
                ))}
              </div>
            </section>
          </>
        )}

        <div className="mt-12 pt-8 border-t border-boss-border">
          <p className="text-xs text-text-muted text-center">
            Categories: Medieval · Sci-Fi · Horror · Nature · Modern · RPG · FPS · Adventure · Puzzle
          </p>
        </div>
      </main>
    </div>
  );
}

function TemplateCard({ template }: { template: GameTemplate }) {
  const rating = template.rating_count > 0 ? template.rating : null;
  const categoryLabel = CATEGORY_LABELS[template.category] ?? template.category;

  return (
    <Link
      href={`/marketplace/${template.id}`}
      className="block rounded-xl border border-boss-border bg-boss-card overflow-hidden hover:border-gold/40 hover:shadow-lg hover:shadow-gold/5 transition-all"
    >
      <div className="aspect-video bg-boss-surface flex items-center justify-center text-4xl border-b border-boss-border">
        {template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
          />
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
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-text-primary truncate">{template.name}</h3>
          {template.is_official && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-gold/20 text-gold">Official</span>
          )}
        </div>
        <p className="text-xs text-text-muted line-clamp-2 mt-0.5">{template.description}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {rating != null && (
            <span className="text-xs text-text-secondary flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {rating.toFixed(1)} ({template.rating_count})
            </span>
          )}
          <span className="text-xs text-text-muted">{categoryLabel}</span>
          <span className="text-xs text-agent-green font-medium">{template.is_free ? "FREE" : ""}</span>
        </div>
        <div className="mt-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-gold font-medium">
            Use template →
          </span>
        </div>
      </div>
    </Link>
  );
}
