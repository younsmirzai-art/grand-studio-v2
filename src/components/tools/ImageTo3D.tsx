"use client";

import { useState, useCallback } from "react";
import { X, Upload, Loader2, Send, Copy, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/stores/uiStore";
import { toast } from "sonner";

export interface ImageTo3DProps {
  projectId: string;
  onCodeGenerated: (code: string, agentName: string) => void;
}

const ACCEPT = "image/jpeg,image/png,image/webp";

export function ImageTo3D({ projectId, onCodeGenerated }: ImageTo3DProps) {
  const setOpen = useUIStore((s) => s.setImageTo3DModalOpen);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [elements, setElements] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [fullResponse, setFullResponse] = useState("");

  const clearFile = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setAnalysis("");
    setElements("");
    setCode(null);
    setFullResponse("");
  }, [previewUrl]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files?.[0];
      if (f && f.type.startsWith("image/")) {
        clearFile();
        setFile(f);
        setPreviewUrl(URL.createObjectURL(f));
      }
    },
    [clearFile]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) {
        clearFile();
        setFile(f);
        setPreviewUrl(URL.createObjectURL(f));
      }
      e.target.value = "";
    },
    [clearFile]
  );

  const analyzeAndBuild = useCallback(async () => {
    if (!file || !projectId) return;
    setAnalyzing(true);
    setAnalysis("");
    setElements("");
    setCode(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("projectId", projectId);
      if (instructions.trim()) formData.append("instructions", instructions.trim());
      const res = await fetch("/api/tools/image-analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setAnalysis(data.analysis ?? "");
      setElements(data.elements ?? "");
      setCode(data.code ?? null);
      setFullResponse(data.fullResponse ?? "");
      toast.success("Analysis complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [file, projectId, instructions]);

  const sendToUE5 = useCallback(() => {
    if (code) {
      onCodeGenerated(code, "Thomas");
      toast.success("Code sent to UE5");
    }
  }, [code, onCodeGenerated]);

  const copyCode = useCallback(() => {
    if (code) {
      navigator.clipboard.writeText(code);
      toast.success("Code copied");
    }
  }, [code]);

  const shareWithTeam = useCallback(() => {
    if (!analysis && !code) return;
    const text = [analysis && `Analysis:\n${analysis}`, elements && `Elements:\n${elements}`, code && `Code:\n\`\`\`python\n${code}\n\`\`\``]
      .filter(Boolean)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Report copied; paste in chat to share with team");
  }, [analysis, elements, code]);

  return (
    <div className="flex flex-col h-full max-h-[85vh] bg-boss-card border border-boss-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-boss-border shrink-0">
        <span className="text-sm font-medium text-text-primary">Image to 3D</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="p-1.5 rounded hover:bg-boss-border text-text-muted hover:text-text-primary"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="border-2 border-dashed border-boss-border rounded-lg p-6 text-center hover:border-agent-teal/50 transition-colors cursor-pointer"
          onClick={() => document.getElementById("image-to-3d-file")?.click()}
        >
          <input
            id="image-to-3d-file"
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={onFileSelect}
          />
          {previewUrl ? (
            <div className="space-y-2">
              <img src={previewUrl} alt="Preview" className="max-h-40 mx-auto rounded object-contain bg-boss-elevated" />
              <p className="text-xs text-text-muted">{file?.name}</p>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); clearFile(); }} className="text-text-muted">
                Remove
              </Button>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 mx-auto text-text-muted mb-2" />
              <p className="text-sm text-text-secondary">Drag & drop image here or click to browse</p>
              <p className="text-xs text-text-muted mt-1">Supports: JPG, PNG, WebP</p>
            </>
          )}
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">Additional instructions (optional)</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Make it bigger, add more trees..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-boss-surface border border-boss-border text-text-primary text-sm placeholder:text-text-muted resize-none"
          />
        </div>

        <Button
          size="sm"
          className="w-full gap-2"
          onClick={analyzeAndBuild}
          disabled={!file || analyzing}
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Analyze & Build
        </Button>

        {analysis && (
          <>
            <div className="border-t border-boss-border pt-3">
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Analysis</h4>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{analysis}</p>
            </div>
            {elements && (
              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Elements</h4>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{elements}</p>
              </div>
            )}
            {code && (
              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Generated Code</h4>
                <pre className="p-3 rounded-lg bg-boss-elevated border border-boss-border text-xs text-text-primary overflow-x-auto max-h-48 overflow-y-auto">
                  {code}
                </pre>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-boss-border shrink-0">
        <Button size="sm" variant="outline" onClick={sendToUE5} disabled={!code} className="gap-1.5 border-boss-border">
          <Send className="w-3.5 h-3.5" />
          Send to UE5
        </Button>
        <Button size="sm" variant="outline" onClick={copyCode} disabled={!code} className="gap-1.5 border-boss-border">
          <Copy className="w-3.5 h-3.5" />
          Copy Code
        </Button>
        <Button size="sm" variant="outline" onClick={analyzeAndBuild} disabled={!file || analyzing} className="gap-1.5 border-boss-border">
          <RefreshCw className="w-3.5 h-3.5" />
          Regenerate
        </Button>
        <Button size="sm" variant="outline" onClick={shareWithTeam} disabled={!analysis && !code} className="gap-1.5 border-boss-border">
          <Share2 className="w-3.5 h-3.5" />
          Share with Team
        </Button>
      </div>
    </div>
  );
}
