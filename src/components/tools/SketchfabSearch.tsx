"use client";

import { useState } from "react";
import { Search, Loader2, Box } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SketchfabResult {
  uid: string;
  name: string;
  thumbnails: { images: { url: string }[] };
  viewerUrl: string;
  user: { displayName: string };
}

export function SketchfabSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SketchfabResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);

    try {
      const res = await fetch(
        `https://api.sketchfab.com/v3/search?type=models&q=${encodeURIComponent(query)}&downloadable=true&count=8`
      );
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-boss-card border border-boss-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-boss-border">
        <Box className="w-4 h-4 text-agent-teal" />
        <span className="text-sm font-medium text-text-primary">3D Asset Search</span>
      </div>

      <div className="p-3">
        <div className="flex gap-2 mb-3">
          <Input
            placeholder="Search 3D models..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="bg-boss-surface border-boss-border text-sm h-8"
          />
          <Button
            size="sm"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="h-8 bg-agent-teal/10 hover:bg-agent-teal/20 text-agent-teal border border-agent-teal/20"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto scrollbar-thin">
            {results.map((r) => (
              <a
                key={r.uid}
                href={r.viewerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block bg-boss-surface rounded-lg overflow-hidden border border-boss-border hover:border-agent-teal/30 transition-colors"
              >
                {r.thumbnails?.images?.[0]?.url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.thumbnails.images[0].url}
                    alt={r.name}
                    className="w-full h-20 object-cover"
                  />
                )}
                <div className="p-2">
                  <p className="text-[11px] font-medium text-text-primary truncate group-hover:text-agent-teal transition-colors">
                    {r.name}
                  </p>
                  <p className="text-[10px] text-text-muted truncate">
                    {r.user?.displayName}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
