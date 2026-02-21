"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Crown,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  ImageIcon,
  Camera,
  Sparkles,
  Settings,
  ListChecks,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const GENRES = [
  "Action",
  "Action RPG",
  "Adventure",
  "RPG",
  "Simulation",
  "Strategy",
  "Horror",
  "Puzzle",
  "Platformer",
  "Shooter",
  "Other",
];

const STEPS = [
  { id: 1, title: "Game Info", icon: Rocket },
  { id: 2, title: "Store Assets", icon: ImageIcon },
  { id: 3, title: "Build Settings", icon: Settings },
  { id: 4, title: "Steam Checklist", icon: ListChecks },
];

interface PublishConfig {
  id?: string;
  project_id: string;
  game_title: string;
  short_description: string;
  long_description: string;
  genre: string;
  tags: string[];
  price: number;
  screenshots: string[];
  header_image: string;
  build_config: { platform?: string; quality?: string };
  status: string;
}

export default function PublishPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [step, setStep] = useState(1);
  const [project, setProject] = useState<{ name: string } | null>(null);
  const [config, setConfig] = useState<PublishConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [gameTitle, setGameTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [genre, setGenre] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [longDesc, setLongDesc] = useState("");
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [headerImage, setHeaderImage] = useState("");
  const [platform, setPlatform] = useState("Win64");
  const [quality, setQuality] = useState("Shipping");
  const [genDescLoading, setGenDescLoading] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    const supabase = getClient();
    const [projRes, configRes] = await Promise.all([
      supabase.from("projects").select("name").eq("id", projectId).single(),
      fetch(`/api/publish/config?projectId=${projectId}`).then((r) => r.json()),
    ]);
    if (projRes.data) setProject(projRes.data as { name: string });
    if (configRes.config) {
      const c = configRes.config as PublishConfig;
      setConfig(c);
      setGameTitle(c.game_title || "");
      setShortDesc(c.short_description || "");
      setGenre(c.genre || "");
      setTagsStr((c.tags || []).join(", "));
      setPrice(c.price ?? 0);
      setLongDesc(c.long_description || "");
      setScreenshots(c.screenshots || []);
      setHeaderImage(c.header_image || "");
      setPlatform(c.build_config?.platform || "Win64");
      setQuality(c.build_config?.quality || "Shipping");
    } else {
      setGameTitle(projRes.data ? (projRes.data as { name: string }).name : "");
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveConfig = useCallback(
    async (overrides: Partial<PublishConfig> = {}) => {
      setSaving(true);
      try {
        const res = await fetch("/api/publish/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            game_title: gameTitle || overrides.game_title,
            short_description: shortDesc || overrides.short_description,
            long_description: longDesc || overrides.long_description,
            genre: genre || overrides.genre,
            tags: tagsStr ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean) : [],
            price: Number(price),
            screenshots: overrides.screenshots ?? screenshots,
            header_image: headerImage || overrides.header_image,
            build_config: { platform, quality },
            status: overrides.status ?? config?.status ?? "draft",
          }),
        });
        const data = await res.json();
        if (res.ok && data.config) {
          setConfig(data.config);
        } else {
          toast.error(data.error ?? "Failed to save");
        }
      } catch {
        toast.error("Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [
      projectId,
      gameTitle,
      shortDesc,
      genre,
      tagsStr,
      price,
      longDesc,
      screenshots,
      headerImage,
      platform,
      quality,
      config?.status,
    ]
  );

  const handleGenerateDescription = async () => {
    setGenDescLoading(true);
    try {
      const res = await fetch("/api/publish/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (res.ok && data.long_description) {
        setLongDesc(data.long_description);
        toast.success("Store description generated");
      } else {
        toast.error(data.error ?? "Generate failed");
      }
    } catch {
      toast.error("Generate failed");
    } finally {
      setGenDescLoading(false);
    }
  };

  const handleCaptureScreenshot = async () => {
    setCaptureLoading(true);
    try {
      await fetch("/api/ue5/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      toast.info("Capture requested. Waiting for screenshot…");
      const supabase = getClient();
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const { data } = await supabase
          .from("ue5_commands")
          .select("screenshot_url")
          .eq("project_id", projectId)
          .not("screenshot_url", "is", null)
          .order("executed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const url = (data as { screenshot_url?: string } | null)?.screenshot_url;
        if (url && !screenshots.includes(url)) {
          setScreenshots((prev) => [...prev, url]);
          toast.success("Screenshot added");
          break;
        }
      }
      if (Date.now() >= deadline) {
        toast.error("Screenshot timed out. Ensure UE5 relay is running and capture completes.");
      }
    } catch {
      toast.error("Capture failed");
    } finally {
      setCaptureLoading(false);
    }
  };

  const projectNameSanitized = (project?.name || gameTitle || "MyGame").replace(/"/g, "").replace(/\s+/g, "");
  const buildCommand = `RunUAT BuildCookRun -project="${projectNameSanitized}" -platform=${platform} -clientconfig=${quality} -cook -stage -package`;

  const copyBuildCommand = () => {
    navigator.clipboard.writeText(buildCommand);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-boss-bg overflow-auto">
      <header className="border-b border-boss-border bg-boss-surface/80 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/project/${projectId}`} className="text-text-muted hover:text-text-primary">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-gold" />
              <h1 className="text-lg font-bold text-text-primary">Publish to Steam</h1>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-2 text-text-muted hover:text-text-primary text-sm">
            <Crown className="w-4 h-4 text-gold" />
            Grand Studio
          </Link>
        </div>
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shrink-0 ${
                step === s.id
                  ? "bg-gold/20 text-gold border border-gold/40"
                  : "bg-boss-card border border-boss-border text-text-secondary hover:text-text-primary"
              }`}
            >
              <s.icon className="w-4 h-4" />
              {s.title}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        {/* Step 1: Game Info */}
        {step === 1 && (
          <div className="rounded-2xl border border-boss-border bg-boss-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">Game Info</h2>
            <div>
              <label className="block text-sm text-text-muted mb-1">Game Title</label>
              <Input
                value={gameTitle}
                onChange={(e) => setGameTitle(e.target.value)}
                placeholder="My Medieval Game"
                className="bg-boss-surface border-boss-border text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Short Description</label>
              <Input
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                placeholder="A dark fantasy action RPG…"
                className="bg-boss-surface border-boss-border text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Genre</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full h-10 rounded-md border border-boss-border bg-boss-surface text-text-primary px-3"
              >
                <option value="">Select genre</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Tags (comma-separated)</label>
              <Input
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                placeholder="medieval, fantasy, rpg"
                className="bg-boss-surface border-boss-border text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Price</label>
              <select
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full h-10 rounded-md border border-boss-border bg-boss-surface text-text-primary px-3"
              >
                <option value={0}>Free</option>
                <option value={4.99}>$4.99</option>
                <option value={9.99}>$9.99</option>
                <option value={14.99}>$14.99</option>
                <option value={19.99}>$19.99</option>
                <option value={24.99}>$24.99</option>
                <option value={29.99}>$29.99</option>
              </select>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(2)} className="gap-2 bg-gold hover:bg-gold/90 text-boss-bg">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Store Assets */}
        {step === 2 && (
          <div className="rounded-2xl border border-boss-border bg-boss-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">Store Assets</h2>
            <div>
              <label className="block text-sm text-text-muted mb-1">Header Image (460×215)</label>
              <div className="flex gap-2">
                <Input
                  value={headerImage}
                  onChange={(e) => setHeaderImage(e.target.value)}
                  placeholder="URL or upload later"
                  className="bg-boss-surface border-boss-border text-text-primary"
                />
                <span className="text-xs text-text-muted self-center">or Auto-generate from UE5</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Screenshots (1280×720, min 5)</label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCaptureScreenshot}
                disabled={captureLoading}
                className="border-boss-border text-text-secondary gap-2"
              >
                {captureLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                Capture from UE5
              </Button>
              <p className="text-xs text-text-muted mt-1">Uses current viewport. Run relay and position camera, then capture.</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {screenshots.map((url, i) => (
                  <div key={i} className="relative w-24 h-14 rounded border border-boss-border overflow-hidden bg-boss-surface">
                    {url.startsWith("http") ? (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs p-1 break-all">{url || "—"}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setScreenshots((p) => p.filter((_, j) => j !== i))}
                      className="absolute top-0 right-0 bg-red-500/80 text-white text-xs px-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-muted mt-1">{screenshots.length} screenshot(s)</p>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Store Description</label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateDescription}
                disabled={genDescLoading}
                className="mb-2 border-agent-violet/50 text-agent-violet hover:bg-agent-violet/10 gap-2"
              >
                {genDescLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Auto-generate with AI
              </Button>
              <Textarea
                value={longDesc}
                onChange={(e) => setLongDesc(e.target.value)}
                placeholder="Elena will write a compelling store description from your game lore…"
                rows={8}
                className="bg-boss-surface border-boss-border text-text-primary placeholder:text-text-muted"
              />
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)} className="gap-2 text-text-muted">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="gap-2 bg-gold hover:bg-gold/90 text-boss-bg">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Build Configuration */}
        {step === 3 && (
          <div className="rounded-2xl border border-boss-border bg-boss-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">Build Settings</h2>
            <div>
              <label className="block text-sm text-text-muted mb-1">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full h-10 rounded-md border border-boss-border bg-boss-surface text-text-primary px-3"
              >
                <option value="Win64">Windows</option>
                <option value="Linux">Linux</option>
                <option value="Mac">Mac</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Quality</label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full h-10 rounded-md border border-boss-border bg-boss-surface text-text-primary px-3"
              >
                <option value="Development">Development</option>
                <option value="Shipping">Shipping (Ultra)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">UE5 Build Command</label>
              <pre className="p-4 rounded-lg bg-boss-bg border border-boss-border text-xs text-text-secondary font-mono whitespace-pre-wrap break-all">
                {buildCommand}
              </pre>
              <Button
                variant="outline"
                size="sm"
                onClick={copyBuildCommand}
                className="mt-2 border-boss-border text-text-secondary gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                Copy Command
              </Button>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(2)} className="gap-2 text-text-muted">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={() => setStep(4)} className="gap-2 bg-gold hover:bg-gold/90 text-boss-bg">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Steam Checklist */}
        {step === 4 && (
          <div className="rounded-2xl border border-boss-border bg-boss-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">Steam Publishing Checklist</h2>
            <p className="text-sm text-text-muted">
              Actually publishing requires Steamworks SDK and a $100 Steam Direct fee. This wizard prepares your assets and build.
            </p>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-center gap-2">☐ Create Steamworks account ($100)</li>
              <li className="flex items-center gap-2">☐ Set up app in Steamworks</li>
              <li className="flex items-center gap-2">☐ Upload store assets</li>
              <li className="flex items-center gap-2">☐ Upload build via SteamPipe</li>
              <li className="flex items-center gap-2">☐ Set pricing and release date</li>
              <li className="flex items-center gap-2">☐ Submit for review</li>
            </ul>
            <a
              href="https://partner.steamgames.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-gold hover:underline"
            >
              Open Steamworks Dashboard <ExternalLink className="w-4 h-4" />
            </a>
            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep(3)} className="gap-2 text-text-muted">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                onClick={async () => {
                  await saveConfig({ status: "ready" });
                  toast.success("Package saved. Use Steamworks to complete publishing.");
                }}
                disabled={saving}
                className="gap-2 bg-agent-green hover:bg-agent-green/90 text-white"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Generate Package
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
