"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  ChevronDown,
  Maximize2,
  RotateCcw,
  Sparkles,
  Wand2,
} from "lucide-react";

const SUGGESTIONS = [
  "Cyberpunk motorcycle",
  "Sci-fi crate",
  "Marble bust",
  "Stylized tree",
];

const STYLES = ["Realistic", "Stylized", "Hard surface", "Organic"];

export function GenerateStudio() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Realistic");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [detail, setDetail] = useState(60);
  const [symmetry, setSymmetry] = useState(80);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Idle");

  const timerRef = useRef<number | null>(null);
  const canGenerate = prompt.trim().length > 8 && !generating;

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const handleGenerate = () => {
    if (!canGenerate) return;
    setGenerating(true);
    setProgress(8);
    setStatus("Queuing job…");
    let value = 8;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      value += Math.random() * 14;
      if (value >= 100) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        setProgress(100);
        setStatus("Preview complete — full generation ships in a later release");
        setGenerating(false);
        return;
      }
      setProgress(Math.round(value));
      setStatus(value < 40 ? "Interpreting prompt…" : "Building mesh preview…");
    }, 280) as unknown as number;
  };

  const progressLabel = useMemo(() => `${progress}%`, [progress]);

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      <div className="mb-5 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-violet-300" />
            <span className="text-[11px] font-semibold text-violet-300 uppercase tracking-wider">
              Studio
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight text-slate-100">
            AI Generator
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Prompt, style, and preview — generation backend is still being wired.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4 min-h-[640px]">
        <aside className="gs-card p-5 flex flex-col">
          <label htmlFor="prompt" className="text-xs font-medium text-slate-400 mb-2">
            Prompt
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="A cyberpunk motorcycle with neon accents, low-poly game ready…"
            className="w-full min-h-36 p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 resize-none outline-none focus:border-[#5E6AD2]/50 focus:bg-white/[0.07] transition-all duration-200 ease-in-out"
          />

          <div className="flex flex-wrap gap-1.5 mt-3">
            {SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPrompt(item)}
                className="px-2.5 py-1 rounded-full text-[11px] text-slate-300 border border-white/10 bg-white/5 hover:border-white/20 hover:text-slate-100 transition-all duration-200 ease-in-out"
              >
                {item}
              </button>
            ))}
          </div>

          <p className="text-xs font-medium text-slate-400 mt-5 mb-2">Art style</p>
          <div className="grid grid-cols-2 gap-2">
            {STYLES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStyle(item)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-200 ease-in-out ${
                  style === item
                    ? "border-[#5E6AD2]/50 bg-[#5E6AD2]/15 text-slate-100"
                    : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-100 hover:border-white/20"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="mt-5 flex items-center justify-between text-xs font-medium text-slate-400 hover:text-slate-100 transition-all duration-200 ease-in-out"
          >
            Advanced settings
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`}
            />
          </button>
          {advancedOpen ? (
            <div className="mt-3 space-y-4">
              <SliderRow
                label="Surface detail"
                value={detail}
                onChange={setDetail}
              />
              <SliderRow
                label="Symmetry"
                value={symmetry}
                onChange={setSymmetry}
              />
            </div>
          ) : null}

          <div className="mt-auto pt-5">
            <button
              type="button"
              disabled={!canGenerate}
              onClick={handleGenerate}
              className="gs-btn gs-btn-primary gs-btn-lg gs-btn-full"
            >
              <Wand2 className="w-4 h-4" />
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>
        </aside>

        <section className="gs-card overflow-hidden flex flex-col min-h-[480px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Box className="w-3.5 h-3.5" />
              Viewport
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all duration-200 ease-in-out"
                aria-label="Reset turntable"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all duration-200 ease-in-out"
                aria-label="Full screen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 gs-viewport-grid min-h-[420px]">
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <div className="w-16 h-16 rounded-2xl border border-white/10 bg-slate-900/60 flex items-center justify-center mb-4">
                <Box className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-200">
                {prompt.trim() ? prompt.trim() : "No preview yet"}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {status === "Idle"
                  ? "Your mesh preview will appear here. Drag to orbit once generation is live."
                  : status}
              </p>
            </div>
          </div>

          <div className="px-4 py-3 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-500">Render</span>
              <span className="text-[11px] text-slate-400 tabular-nums">
                {progressLabel}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#5E6AD2] transition-all duration-200 ease-in-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className="text-[11px] text-slate-300 tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-cyan-400"
      />
    </label>
  );
}
