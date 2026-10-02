"use client";

import { Check, X } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { InfoTip } from "@/components/ui/InfoTip";
import type { CompetitiveBenchmark } from "@/lib/analysis";
import type { BacktestMetrics } from "@/lib/types";

const BADGE: Record<string, string> = {
  Numerai: "border-teal-400/25 bg-teal-400/10 text-teal-300",
  WorldQuant: "border-sky-400/25 bg-sky-400/10 text-sky-300",
};

const FOCUS: Record<string, string> = { "IC Mean": "IC", "IC-IR": "IC-IR", Sharpe: "Sharpe", Fitness: "Fitness" };

export function PlatformFit({ benchmarks, metrics }: { benchmarks: CompetitiveBenchmark[]; metrics: BacktestMetrics }) {
  if (!benchmarks.length) return null;
  const passed = benchmarks.filter((b) => b.passes).length;
  const turnover = Math.max(metrics.avg_daily_turnover, 0.125);

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title="Platform fit"
        hint="Rule-of-thumb bars borrowed from Numerai and WorldQuant. Not official pass/fail criteria."
        right={
          <span
            className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${
              passed === benchmarks.length
                ? "border-up/30 bg-up/10 text-up"
                : passed === 0
                  ? "border-down/30 bg-down/10 text-down"
                  : "border-white/10 bg-white/[0.04] text-gray-300"
            }`}
          >
            {passed}/{benchmarks.length} pass
          </span>
        }
      />
      <div className="flex flex-1 flex-col justify-between gap-4 px-5 pb-5 pt-1">
        {benchmarks.map((b) => {
          const scaleMax = Math.abs(b.threshold) * 2;
          const fill = Math.max(0, Math.min(1, b.yourValue / scaleMax));
          const color = b.passes ? "#3ddc97" : "#ff5470";
          return (
            <div key={`${b.platform}-${b.metric}`}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${BADGE[b.platform] ?? "border-white/10 text-gray-400"}`}>
                    {b.platform}
                  </span>
                  <span className="truncate text-[13px] font-medium text-gray-200">{b.metric}</span>
                  <InfoTip text={b.description} focus={FOCUS[b.metric]} />
                </div>
                <div className="flex flex-shrink-0 items-center gap-2 font-mono text-xs tnum">
                  <span style={{ color }} className="font-semibold">
                    {b.yourValue.toFixed(b.metric === "IC Mean" ? 4 : 2)}
                  </span>
                  <span className="text-gray-600">/ {b.threshold.toFixed(b.metric === "IC Mean" ? 2 : 1)}</span>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: `${color}22`, color }}>
                    {b.passes ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : <X className="h-2.5 w-2.5" strokeWidth={3.5} />}
                  </span>
                </div>
              </div>
              <div className="relative h-1.5 rounded-full bg-white/[0.06]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${fill * 100}%`,
                    background: color,
                    transition: "width 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                />
                <div className="absolute -top-[3px] h-[12px] w-px bg-white/50" style={{ left: "50%" }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-white/[0.07] bg-black/20 px-5 py-3 font-mono text-[10.5px] leading-relaxed text-gray-500">
        <span className="text-gray-600">Fitness =</span> Sharpe <span className="text-gray-300">{metrics.sharpe.toFixed(2)}</span> × √(|return|{" "}
        <span className="text-gray-300">{(Math.abs(metrics.annual_return) * 100).toFixed(1)}%</span> ÷ turnover{" "}
        <span className="text-gray-300">{(turnover * 100).toFixed(1)}%</span>)
      </div>
    </Panel>
  );
}
