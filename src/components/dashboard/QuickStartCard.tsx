import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

export function QuickStartCard() {
  return (
    <div className="gs-card p-5 h-full relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="gs-mark w-8 h-8">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.14em]">
            Studio
          </span>
        </div>

        <h3 className="font-display font-semibold text-lg text-slate-100 mb-2">
          Try AI Generator
        </h3>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Describe a model in plain language. Preview the studio workspace and
          generate when you are ready.
        </p>

        <Link href="/generate" className="gs-btn gs-btn-primary">
          Open studio
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
