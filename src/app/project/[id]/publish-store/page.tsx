"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, DollarSign, ImageIcon, FileText, Settings, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/collaboration/user";
import { useProjectStore } from "@/lib/stores/projectStore";
import { toast } from "sonner";

const GENRES = ["action", "rpg", "horror", "adventure", "puzzle", "simulation", "strategy", "sports", "racing"];
const STEPS = ["Game Info", "Store Assets", "Description", "System Requirements", "Review & Publish"];
const PRICE_OPTIONS = [0, 0.99, 2.99, 4.99, 9.99, 14.99, 19.99, 29.99, 59.99];

export default function PublishStorePage() {
  const params = useParams();
  const projectId = params?.id as string;
  const project = useProjectStore((s) => s.project);
  const { userEmail } = getCurrentUser();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [genre, setGenre] = useState("action");
  const [tags, setTags] = useState("");
  const [price, setPrice] = useState(0);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [screenshots, setScreenshots] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [fileSizeMb, setFileSizeMb] = useState(0);
  const [systemMin, setSystemMin] = useState("");
  const [systemRec, setSystemRec] = useState("");
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (project?.name) setTitle(project.name);
    if (project?.summary) setDescription(project.summary ?? "");
  }, [project?.name, project?.summary]);

  const handleGenerateDescription = async () => {
    if (!title || !description || generatingDesc) return;
    setGeneratingDesc(true);
    try {
      const res = await fetch("/api/publish/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, shortDescription: description, genre }),
      });
      const data = await res.json();
      if (res.ok && data.longDescription) {
        setLongDescription(data.longDescription);
        toast.success("Description generated");
      } else {
        setLongDescription(description);
      }
    } catch {
      setLongDescription(description);
    } finally {
      setGeneratingDesc(false);
    }
  };

  const handleSubmit = async (publishStatus: "draft" | "under_review" | "published") => {
    if (!userEmail?.trim()) {
      toast.error("Set your email in Team page first");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/store/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sellerEmail: userEmail.trim(),
          title: title.trim(),
          description: description.trim(),
          longDescription: longDescription.trim() || null,
          genre,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          price: Number(price),
          isFree: Number(price) === 0,
          thumbnailUrl: thumbnailUrl.trim() || null,
          screenshots: screenshots.split("\n").map((s) => s.trim()).filter(Boolean),
          trailerUrl: trailerUrl.trim() || null,
          downloadUrl: downloadUrl.trim() || null,
          fileSizeMb: Number(fileSizeMb) || 0,
          platforms: ["windows"],
          systemRequirements: { minimum: systemMin.trim(), recommended: systemRec.trim() },
          status: publishStatus,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(publishStatus === "published" ? "Published to store!" : publishStatus === "under_review" ? "Submitted for review" : "Draft saved");
        if (data.id) window.location.href = `/store/${data.id}`;
      } else {
        toast.error(data.error ?? "Failed");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-boss-bg p-6">
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/project/${projectId}`}
          className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary text-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to project
        </Link>
        <h1 className="text-2xl font-bold text-text-primary mb-2 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-gold" />
          Publish to Store
        </h1>
        <p className="text-text-muted text-sm mb-8">Fill in the steps below to list your game.</p>

        <div className="flex gap-2 mb-8 overflow-x-auto">
          {STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(i)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                step === i ? "bg-gold text-boss-bg" : "bg-boss-card border border-boss-border text-text-secondary hover:text-text-primary"
              }`}
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4 rounded-xl border border-boss-border bg-boss-card p-6">
            <h2 className="font-semibold text-text-primary">Game Info</h2>
            <div>
              <label className="block text-xs text-text-muted mb-1">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-boss-surface border-boss-border" placeholder="Game title" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Short description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="bg-boss-surface border-boss-border" placeholder="One line description" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Genre</label>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full h-9 rounded-md border border-boss-border bg-boss-surface text-text-primary px-3">
                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Tags (comma-separated)</label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} className="bg-boss-surface border-boss-border" placeholder="adventure, singleplayer, ..." />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Price (USD)</label>
              <select value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full h-9 rounded-md border border-boss-border bg-boss-surface text-text-primary px-3">
                <option value={0}>Free</option>
                {PRICE_OPTIONS.filter((p) => p > 0).map((p) => (
                  <option key={p} value={p}>${p.toFixed(2)}</option>
                ))}
              </select>
            </div>
            <Button onClick={() => setStep(1)} className="w-full gap-2">Next: Store Assets</Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 rounded-xl border border-boss-border bg-boss-card p-6">
            <h2 className="font-semibold text-text-primary flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Store Assets</h2>
            <div>
              <label className="block text-xs text-text-muted mb-1">Thumbnail URL</label>
              <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} className="bg-boss-surface border-boss-border" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Screenshots (one URL per line)</label>
              <Textarea value={screenshots} onChange={(e) => setScreenshots(e.target.value)} rows={3} className="bg-boss-surface border-boss-border" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Trailer video URL</label>
              <Input value={trailerUrl} onChange={(e) => setTrailerUrl(e.target.value)} className="bg-boss-surface border-boss-border" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Download URL (for buyers)</label>
              <Input value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} className="bg-boss-surface border-boss-border" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">File size (MB)</label>
              <Input type="number" value={fileSizeMb || ""} onChange={(e) => setFileSizeMb(Number(e.target.value) || 0)} className="bg-boss-surface border-boss-border" placeholder="0" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)} className="border-boss-border">Back</Button>
              <Button onClick={() => setStep(2)} className="flex-1">Next: Description</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 rounded-xl border border-boss-border bg-boss-card p-6">
            <h2 className="font-semibold text-text-primary flex items-center gap-2"><FileText className="w-4 h-4" /> Description</h2>
            <div>
              <Button variant="outline" size="sm" onClick={handleGenerateDescription} disabled={generatingDesc} className="mb-2 gap-2 border-boss-border">
                {generatingDesc ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Auto-generate with AI
              </Button>
              <label className="block text-xs text-text-muted mb-1">Long description (store page)</label>
              <Textarea value={longDescription} onChange={(e) => setLongDescription(e.target.value)} rows={8} className="bg-boss-surface border-boss-border" placeholder="Full description for the store page..." />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="border-boss-border">Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1">Next: System Requirements</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 rounded-xl border border-boss-border bg-boss-card p-6">
            <h2 className="font-semibold text-text-primary flex items-center gap-2"><Settings className="w-4 h-4" /> System Requirements</h2>
            <div>
              <label className="block text-xs text-text-muted mb-1">Minimum</label>
              <Input value={systemMin} onChange={(e) => setSystemMin(e.target.value)} className="bg-boss-surface border-boss-border" placeholder="e.g. i5-8400, GTX 1060, 8GB RAM" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Recommended</label>
              <Input value={systemRec} onChange={(e) => setSystemRec(e.target.value)} className="bg-boss-surface border-boss-border" placeholder="e.g. i7-10700, RTX 3070, 16GB RAM" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="border-boss-border">Back</Button>
              <Button onClick={() => setStep(4)} className="flex-1">Next: Review & Publish</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 rounded-xl border border-boss-border bg-boss-card p-6">
            <h2 className="font-semibold text-text-primary flex items-center gap-2"><Check className="w-4 h-4" /> Review & Publish</h2>
            <div className="rounded-lg bg-boss-surface p-4 text-sm">
              <p><strong>Title:</strong> {title || "—"}</p>
              <p><strong>Genre:</strong> {genre}</p>
              <p><strong>Price:</strong> {price === 0 ? "Free" : `$${price.toFixed(2)}`}</p>
              <p><strong>Description:</strong> {(description || "").slice(0, 100)}...</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="border-boss-border">Back</Button>
              <Button variant="outline" disabled={submitting} onClick={() => handleSubmit("draft")} className="border-boss-border gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save as draft
              </Button>
              <Button disabled={submitting} onClick={() => handleSubmit("under_review")} className="bg-gold/80 hover:bg-gold/90 text-boss-bg gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Submit for review
              </Button>
              <Button disabled={submitting} onClick={() => handleSubmit("published")} className="bg-gold hover:bg-gold/90 text-boss-bg gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Publish now
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
