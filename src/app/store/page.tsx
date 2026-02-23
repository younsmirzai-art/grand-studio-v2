"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Crown, Search, Star, Loader2, DollarSign, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Listing {
  id: string;
  title: string;
  description: string;
  genre: string;
  price: number;
  is_free: boolean;
  thumbnail_url: string | null;
  rating: number;
  rating_count: number;
  download_count: number;
  status: string;
  published_at: string | null;
}

const GENRES = [
  "all",
  "action",
  "rpg",
  "horror",
  "adventure",
  "puzzle",
  "simulation",
  "strategy",
  "sports",
  "racing",
];
const SORT_OPTIONS = [
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Rating" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "downloads", label: "Most Downloads" },
];

function GameCard({ listing }: { listing: Listing }) {
  return (
    <Link href={`/store/${listing.id}`}>
      <div className="rounded-xl border border-boss-border bg-boss-card overflow-hidden hover:border-gold/40 transition-colors">
        <div className="aspect-video bg-boss-elevated flex items-center justify-center">
          {listing.thumbnail_url ? (
            <img
              src={listing.thumbnail_url}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-4xl text-text-muted">🎮</span>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-text-primary truncate">{listing.title}</h3>
          <p className="text-xs text-text-muted truncate mt-0.5">{listing.description}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="flex items-center gap-1 text-amber-500 text-xs">
              <Star className="w-3.5 h-3.5 fill-current" />
              {(listing.rating || 0).toFixed(1)}
            </span>
            <span className="text-xs text-text-muted">{listing.download_count ?? 0} ⬇️</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            {listing.is_free || listing.price === 0 ? (
              <span className="text-sm font-medium text-agent-green">FREE</span>
            ) : (
              <span className="text-sm font-medium text-gold">${Number(listing.price).toFixed(2)}</span>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs text-text-secondary">
              View
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function StorePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState("trending");

  useEffect(() => {
    const params = new URLSearchParams();
    if (genre !== "all") params.set("genre", genre);
    params.set("sort", sort);
    if (search.trim()) params.set("search", search.trim());
    setLoading(true);
    fetch(`/api/store/listings?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setListings(data.listings ?? []);
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [genre, sort, search]);

  const trending = useMemo(() => listings.slice(0, 8), [listings]);
  const topRated = useMemo(
    () => [...listings].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 8),
    [listings]
  );
  const freeGames = useMemo(
    () => listings.filter((l) => l.is_free || l.price === 0),
    [listings]
  );
  const recent = useMemo(
    () => [...listings].sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? "")).slice(0, 8),
    [listings]
  );

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
          <div className="flex items-center gap-2">
            <Link href="/store">
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                Store
              </Button>
            </Link>
            <Link href="/seller">
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                Seller
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                Templates
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-text-primary flex items-center justify-center gap-2">
            <DollarSign className="w-8 h-8 text-gold" />
            Grand Studio Game Store
          </h1>
          <p className="text-text-muted mt-2">
            Games built by AI, played by humans
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-8">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              placeholder="Search games..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-boss-card border-boss-border text-text-primary"
            />
          </div>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="h-9 rounded-md border border-boss-border bg-boss-card text-text-primary text-sm px-3"
          >
            {GENRES.map((g) => (
              <option key={g} value={g}>{g === "all" ? "Genre" : g}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 rounded-md border border-boss-border bg-boss-card text-text-primary text-sm px-3"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-boss-border bg-boss-card/50">
            <p className="text-text-muted">No games published yet. Publish your first game from a project.</p>
            <Link href="/" className="inline-block mt-4">
              <Button className="bg-gold hover:bg-gold/90 text-boss-bg">Dashboard</Button>
            </Link>
          </div>
        ) : (
          <>
            <section className="mb-10">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gold" />
                Trending This Week
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {trending.map((l) => (
                  <GameCard key={l.id} listing={l} />
                ))}
              </div>
            </section>

            <section className="mb-10">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
                Categories
              </h2>
              <div className="flex flex-wrap gap-2">
                {GENRES.filter((g) => g !== "all").map((g) => (
                  <Link key={g} href={`/store?genre=${g}`}>
                    <Button
                      variant={genre === g ? "secondary" : "ghost"}
                      size="sm"
                      className="capitalize"
                    >
                      {g}
                    </Button>
                  </Link>
                ))}
              </div>
            </section>

            <section className="mb-10">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                Top Rated
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {topRated.map((l) => (
                  <GameCard key={l.id} listing={l} />
                ))}
              </div>
            </section>

            {freeGames.length > 0 && (
              <section className="mb-10">
                <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
                  Free Games
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {freeGames.slice(0, 8).map((l) => (
                    <GameCard key={l.id} listing={l} />
                  ))}
                </div>
              </section>
            )}

            <section className="mb-10">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
                Recently Published
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {recent.map((l) => (
                  <GameCard key={l.id} listing={l} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
