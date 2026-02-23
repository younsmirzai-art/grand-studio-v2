"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Crown, Star, Loader2, ShoppingCart, Gamepad2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/collaboration/user";
import { toast } from "sonner";

interface Listing {
  id: string;
  title: string;
  description: string;
  long_description: string | null;
  genre: string;
  seller_email: string;
  price: number;
  is_free: boolean;
  thumbnail_url: string | null;
  screenshots: string[];
  trailer_url: string | null;
  download_url: string | null;
  file_size_mb: number;
  rating: number;
  rating_count: number;
  download_count: number;
  published_at: string | null;
  system_requirements: Record<string, unknown>;
}

interface Review {
  id: string;
  reviewer_email: string;
  rating: number;
  title: string | null;
  review_text: string | null;
  helpful_count: number;
  created_at: string;
}

export default function StoreDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const purchased = searchParams?.get("purchased") === "true";
  const sessionId = searchParams?.get("session_id");

  const [listing, setListing] = useState<Listing | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [screenshotIndex, setScreenshotIndex] = useState(0);

  const { userEmail, userName } = getCurrentUser();

  useEffect(() => {
    if (!id) return;
    fetch(`/api/store/listings/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.id) setListing(data as Listing);
        else setListing(null);
      })
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/store/reviews?listingId=${id}`)
      .then((res) => res.json())
      .then((data) => setReviews(data.reviews ?? []))
      .catch(() => setReviews([]));
  }, [id]);

  useEffect(() => {
    if (!purchased || !sessionId || !id || confirming) return;
    setConfirming(true);
    fetch("/api/store/confirm-purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.downloadUrl) setDownloadUrl(data.downloadUrl);
        if (data.alreadyRecorded && data.downloadUrl) setDownloadUrl(data.downloadUrl);
      })
      .catch(() => toast.error("Could not confirm purchase"))
      .finally(() => setConfirming(false));
  }, [id, purchased, sessionId, confirming]);

  const handleBuy = async () => {
    if (!listing || buying || !userEmail?.trim()) {
      if (!userEmail?.trim()) toast.error("Set your email in Team page first");
      return;
    }
    setBuying(true);
    try {
      const res = await fetch("/api/store/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id, buyerEmail: userEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.free && data.downloadUrl) {
        setDownloadUrl(data.downloadUrl);
        toast.success("Download recorded");
      } else if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      } else {
        toast.error(data.error ?? "Purchase failed");
      }
    } catch {
      toast.error("Purchase failed");
    } finally {
      setBuying(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!listing || !userEmail?.trim() || submittingReview) return;
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/store/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          reviewerEmail: userEmail.trim(),
          rating: reviewRating,
          title: reviewTitle.trim() || undefined,
          reviewText: reviewText.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Review submitted");
        setReviewTitle("");
        setReviewText("");
        fetch(`/api/store/reviews?listingId=${id}`)
          .then((r) => r.json())
          .then((d) => setReviews(d.reviews ?? []));
        if (listing) setListing({ ...listing, rating: data.rating ?? listing.rating, rating_count: data.rating_count ?? listing.rating_count });
      } else {
        toast.error(data.error ?? "Failed to submit review");
      }
    } catch {
      toast.error("Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const screenshots = useMemo(() => {
    if (!listing) return [];
    const list = listing.screenshots && Array.isArray(listing.screenshots) ? listing.screenshots : [];
    if (listing.thumbnail_url && !list.includes(listing.thumbnail_url)) {
      return [listing.thumbnail_url, ...list];
    }
    return list.length ? list : (listing.thumbnail_url ? [listing.thumbnail_url] : []);
  }, [listing]);

  if (loading || !listing) {
    return (
      <div className="min-h-screen bg-boss-bg flex items-center justify-center">
        {loading ? <Loader2 className="w-8 h-8 animate-spin text-gold" /> : <p className="text-text-muted">Game not found</p>}
      </div>
    );
  }

  const sysReq = listing.system_requirements && typeof listing.system_requirements === "object" ? listing.system_requirements as Record<string, string> : {};
  const minReq = sysReq.minimum ?? sysReq.min ?? "";
  const recReq = sysReq.recommended ?? sysReq.rec ?? "";

  return (
    <div className="min-h-screen bg-boss-bg">
      <nav className="sticky top-0 z-40 border-b border-boss-border bg-boss-surface/95 glass-strong">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/store" className="flex items-center gap-2 text-text-primary hover:opacity-90">
            <Crown className="w-4 h-4 text-gold" />
            <span className="font-bold text-sm">Grand Studio Store</span>
          </Link>
          <Link href="/store">
            <Button variant="ghost" size="sm">Back to Store</Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div>
            {screenshots.length > 0 ? (
              <div className="rounded-xl overflow-hidden border border-boss-border bg-boss-elevated">
                <img
                  src={screenshots[screenshotIndex]}
                  alt={listing.title}
                  className="w-full aspect-video object-cover"
                />
                {screenshots.length > 1 && (
                  <div className="flex gap-1 p-2 overflow-x-auto">
                    {screenshots.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setScreenshotIndex(i)}
                        className={`shrink-0 w-16 h-10 rounded overflow-hidden border-2 ${i === screenshotIndex ? "border-gold" : "border-transparent"}`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-boss-border bg-boss-elevated aspect-video flex items-center justify-center">
                {listing.thumbnail_url ? (
                  <img src={listing.thumbnail_url} alt={listing.title} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className="text-6xl text-text-muted">🎮</span>
                )}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{listing.title}</h1>
            <p className="text-text-muted text-sm mt-1">
              by {listing.seller_email?.split("@")[0] ?? "Creator"} · {listing.genre} · Released {listing.published_at ? new Date(listing.published_at).toLocaleDateString() : "—"}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-amber-500">
                <Star className="w-4 h-4 fill-current" />
                {(listing.rating || 0).toFixed(1)}
              </span>
              <span className="text-text-muted text-sm">({listing.rating_count ?? 0} reviews)</span>
              <span className="text-text-muted text-sm">{listing.download_count ?? 0} downloads</span>
            </div>
            <div className="mt-6 flex items-center gap-3">
              {listing.is_free || listing.price === 0 ? (
                <span className="text-xl font-bold text-agent-green">FREE</span>
              ) : (
                <span className="text-xl font-bold text-gold">${Number(listing.price).toFixed(2)}</span>
              )}
              <Button
                onClick={handleBuy}
                disabled={buying || (!userEmail?.trim() && !listing.is_free)}
                className="bg-gold hover:bg-gold/90 text-boss-bg gap-2"
              >
                {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                {listing.is_free ? "Get free" : "Buy Now"}
              </Button>
              {listing.trailer_url && (
                <a href={listing.trailer_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="border-boss-border gap-2">
                    <Gamepad2 className="w-4 h-4" />
                    Try Demo
                  </Button>
                </a>
              )}
            </div>
            {(downloadUrl || (purchased && confirming)) && (
              <div className="mt-4 p-4 rounded-lg bg-agent-green/10 border border-agent-green/30">
                {confirming ? (
                  <span className="flex items-center gap-2 text-agent-green"><Loader2 className="w-4 h-4 animate-spin" /> Confirming purchase…</span>
                ) : downloadUrl ? (
                  <div>
                    <p className="text-agent-green font-medium flex items-center gap-2"><Check className="w-4 h-4" /> Purchase complete</p>
                    <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-gold hover:underline mt-1 block">Download game</a>
                  </div>
                ) : purchased ? (
                  <p className="text-text-muted text-sm">Thank you for your purchase. Download link will appear shortly.</p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-2">About This Game</h2>
          <p className="text-text-secondary whitespace-pre-wrap">{listing.long_description || listing.description}</p>
        </section>

        {(minReq || recReq) && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-text-primary mb-2">System Requirements</h2>
            {minReq && <p className="text-sm text-text-secondary"><strong>Minimum:</strong> {minReq}</p>}
            {recReq && <p className="text-sm text-text-secondary mt-1"><strong>Recommended:</strong> {recReq}</p>}
          </section>
        )}

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Reviews ({(listing.rating_count ?? 0)})</h2>
          <div className="space-y-3 mb-6">
            {reviews.slice(0, 10).map((r) => (
              <div key={r.id} className="p-3 rounded-lg border border-boss-border bg-boss-card">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={`w-4 h-4 ${i <= r.rating ? "fill-current" : ""}`} />
                    ))}
                  </span>
                  <span className="text-sm text-text-muted">{r.reviewer_email?.split("@")[0]} · {new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.title && <p className="font-medium text-text-primary mt-1">{r.title}</p>}
                {r.review_text && <p className="text-sm text-text-secondary mt-0.5">{r.review_text}</p>}
              </div>
            ))}
          </div>
          {userEmail?.trim() && (
            <div className="p-4 rounded-xl border border-boss-border bg-boss-card">
              <p className="text-sm font-medium text-text-primary mb-2">Write a review</p>
              <div className="flex gap-2 mb-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReviewRating(i)}
                    className={`p-1 ${i <= reviewRating ? "text-amber-500" : "text-text-muted"}`}
                  >
                    <Star className="w-5 h-5 fill-current" />
                  </button>
                ))}
              </div>
              <Input
                placeholder="Review title (optional)"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                className="mb-2 bg-boss-surface border-boss-border"
              />
              <Textarea
                placeholder="Your review..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
                className="mb-2 bg-boss-surface border-boss-border"
              />
              <Button onClick={handleSubmitReview} disabled={submittingReview} size="sm" className="gap-2">
                {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Submit review
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-boss-border bg-boss-card p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-2">Built with Grand Studio</h2>
          <p className="text-text-muted text-sm mb-3">This game was created using Grand Studio AI agents.</p>
          <Link href="/">
            <Button variant="outline" size="sm" className="border-boss-border">Build something like this</Button>
          </Link>
        </section>
      </main>
    </div>
  );
}
