"use client";

import { useState } from "react";
import { Wrench, RefreshCw, Share2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlaytestReport } from "@/lib/agents/playtester";

interface PlaytestReportCardProps {
  report: PlaytestReport;
  screenshotUrl?: string;
  onFixCritical?: (issues: string[]) => void;
  onRetest?: () => void;
}

function scoreColor(score: number): string {
  if (score < 4) return "text-red-500";
  if (score < 7) return "text-amber-500";
  return "text-green-500";
}

function scoreBg(score: number): string {
  if (score < 4) return "bg-red-500/20 border-red-500/40";
  if (score < 7) return "bg-amber-500/20 border-amber-500/40";
  return "bg-green-500/20 border-green-500/40";
}

export function PlaytestReportCard({
  report,
  screenshotUrl,
  onFixCritical,
  onRetest,
}: PlaytestReportCardProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) =>
    setExpanded((e) => ({ ...e, [key]: !e[key] }));

  const hasCritical = report.criticalIssues.length > 0;
  const fixCritical = () =>
    hasCritical && onFixCritical?.(report.criticalIssues);

  const copyReport = () => {
    const text = [
      `Score: ${report.score}/10`,
      "🔴 Critical: " + report.criticalIssues.join("; "),
      "🟡 Warnings: " + report.warnings.join("; "),
      "🟢 Minor: " + report.minorIssues.join("; "),
      "✅ Good: " + report.positives.join("; "),
      "💡 Suggestions: " + report.suggestions.join("; "),
    ].join("\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="rounded-xl border border-boss-border bg-boss-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-boss-border bg-boss-elevated/50">
        <span className="text-sm font-medium text-text-primary">🎮 Playtest Report</span>
        <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 ${scoreBg(report.score)} ${scoreColor(report.score)} font-bold`}>
          {report.score}/10
        </div>
      </div>
      {screenshotUrl && (
        <div className="p-2 border-b border-boss-border">
          <img src={screenshotUrl} alt="Screenshot" className="max-h-32 w-full object-contain rounded-lg bg-boss-elevated" />
        </div>
      )}
      <div className="p-3 space-y-3 text-sm">
        {report.criticalIssues.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => toggle("critical")}
              className="flex items-center gap-2 w-full text-left font-medium text-red-500"
            >
              🔴 Critical Issues ({report.criticalIssues.length})
            </button>
            {(expanded.critical ?? true) && (
              <ul className="mt-1 pl-4 list-disc text-text-secondary space-y-0.5">
                {report.criticalIssues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {report.warnings.length > 0 && (
          <div>
            <button type="button" onClick={() => toggle("warnings")} className="flex items-center gap-2 w-full text-left font-medium text-amber-500">
              🟡 Warnings ({report.warnings.length})
            </button>
            {(expanded.warnings ?? true) && (
              <ul className="mt-1 pl-4 list-disc text-text-secondary space-y-0.5">
                {report.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {report.minorIssues.length > 0 && (
          <div>
            <button type="button" onClick={() => toggle("minor")} className="flex items-center gap-2 w-full text-left font-medium text-green-600">
              🟢 Minor ({report.minorIssues.length})
            </button>
            {(expanded.minor ?? true) && (
              <ul className="mt-1 pl-4 list-disc text-text-secondary space-y-0.5">
                {report.minorIssues.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {report.positives.length > 0 && (
          <div>
            <span className="font-medium text-text-primary">✅ What&apos;s Good</span>
            <ul className="mt-1 pl-4 list-disc text-text-secondary space-y-0.5">
              {report.positives.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {report.suggestions.length > 0 && (
          <div>
            <span className="font-medium text-text-primary">💡 Suggestions</span>
            <ul className="mt-1 pl-4 list-disc text-text-secondary space-y-0.5">
              {report.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 p-3 border-t border-boss-border">
        {hasCritical && onFixCritical && (
          <Button size="sm" variant="outline" className="gap-1.5 border-red-500/50 text-red-500" onClick={fixCritical}>
            <Wrench className="w-3.5 h-3.5" />
            Fix Critical
          </Button>
        )}
        {onRetest && (
          <Button size="sm" variant="outline" className="gap-1.5 border-boss-border" onClick={onRetest}>
            <RefreshCw className="w-3.5 h-3.5" />
            Re-test
          </Button>
        )}
        <Button size="sm" variant="ghost" className="gap-1.5 text-text-muted" onClick={copyReport}>
          <Copy className="w-3.5 h-3.5" />
          Copy
        </Button>
      </div>
    </div>
  );
}
