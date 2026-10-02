"use client";

import { ArrowRight, Lightbulb } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { InfoTip } from "@/components/ui/InfoTip";
import type { RegimeBreakdown, SignalAnalysis } from "@/lib/analysis";

const TONE: Record<RegimeBreakdown["assessment"], { color: string; label: string }> = {
  strong: { color: "#3ddc97", label: "Strong" },
  neutral: { color: "#7cc4ff", label: "Moderate" },
  weak: { color: "#ffc857", label: "Weak" },
  negative: { color: "#ff5470", label: "Inverse" },
};

export function Regimes({ regimes }: { regimes: RegimeBreakdown[] }) {
  if (!regimes.length) return null;
  const scale = 0.04;
  return (
    <Panel className="flex flex-col">
      <PanelHeader title="Regime stability" hint="Mean IC in three equal slices of the test period. A durable alpha holds up in all of them." />
      <div className="flex flex-1 flex-col justify-around gap-4 px-5 pb-5 pt-1">
        {regimes.map((r, i) => {
          const tone = TONE[r.assessment];
          const w = Math.max(0.03, Math.min(1, Math.abs(r.icMean) / scale));
          return (
            <div key={i}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="font-mono text-[11px] text-gray-500">{r.label}</span>
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-semibold tnum" style={{ color: tone.color }}>
                    {r.icMean >= 0 ? "+" : "−"}
                    {Math.abs(r.icMean).toFixed(4)}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: tone.color }}>
                    {tone.label}
                  </span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${w * 100}%`,
                    background: tone.color,
                    transition: "width 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                />
              </div>
            </div>
          );
        })}
        <p className="pt-1 text-[11px] leading-relaxed text-gray-600">Bar scale: full width = IC of 0.04.</p>
      </div>
    </Panel>
  );
}

export function Insights({ analysis }: { analysis: SignalAnalysis }) {
  const { diagnosis, suggestions } = analysis;
  if (!diagnosis.length && !suggestions.length) return null;

  return (
    <Panel>
      <PanelHeader
        title="Diagnosis"
        hint="Rule-based read of the result. Deterministic, no model calls."
        right={<InfoTip text="These notes are generated from fixed rules over the metrics, not by a language model. They flag the usual suspects: weak IC, unstable IC-IR, heavy turnover, deep drawdowns." />}
      />
      <div className={`grid gap-6 px-5 pb-5 pt-1 ${suggestions.length > 0 ? "md:grid-cols-[1.4fr_1fr]" : ""}`}>
        <ul className="space-y-3">
          {diagnosis.map((line, i) => (
            <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-gray-400">
              <span className="mt-[9px] h-1 w-1 flex-shrink-0 rounded-full bg-lava-500" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        {suggestions.length > 0 && (
          <div>
            <div className="mb-2.5 flex items-center gap-1.5 eyebrow">
              <Lightbulb className="h-3 w-3 text-lava-400" /> Try next
            </div>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="flex gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-xs leading-relaxed text-gray-300">
                  <ArrowRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-lava-400" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
