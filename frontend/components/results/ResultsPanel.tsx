"use client";

import { useMemo } from "react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { InfoTip } from "@/components/ui/InfoTip";
import { ResultsHero } from "./ResultsHero";
import { ICChart } from "./ICChart";
import { EquityChart } from "./EquityChart";
import { QuantileChart } from "./QuantileChart";
import { FeatureImportanceChart } from "./FeatureImportanceChart";
import { PlatformFit } from "./PlatformFit";
import { MonthlyHeatmap } from "./MonthlyHeatmap";
import { Insights, Regimes } from "./Insights";
import { analyzeResult } from "@/lib/analysis";
import { computeScore } from "@/lib/score";
import { clean, quantileStats } from "@/lib/derive";
import type { BacktestResponse } from "@/lib/types";
import type { ResultMeta } from "@/lib/bus";

interface ResultsPanelProps {
  result: BacktestResponse;
  meta?: ResultMeta;
}

const d = (i: number) => ({ ["--i" as string]: i });

export function ResultsPanel({ result, meta = { source: "live" } }: ResultsPanelProps) {
  const { ic_series, equity_curve, quantile_returns, feature_importance } = result;

  const analysis = useMemo(() => analyzeResult(result), [result]);
  const score = useMemo(() => computeScore(result.metrics), [result]);
  const total = useMemo(() => {
    const eq = clean(equity_curve);
    return eq.length > 1 ? eq[eq.length - 1].value / eq[0].value - 1 : 0;
  }, [equity_curve]);
  const q = useMemo(() => quantileStats(quantile_returns), [quantile_returns]);

  return (
    <div className="space-y-4 pb-24">
      <ResultsHero result={result} analysis={analysis} score={score} meta={meta} />

      <div className="grid-2-1">
        {equity_curve.length > 0 && (
          <Panel className="reveal" style={d(5)}>
            <PanelHeader
              title="Performance"
              hint="Growth of the long-short portfolio. Scrub the chart; the drawdown view stays in sync."
              right={
                <div className="text-right">
                  <div className={`font-mono text-lg font-semibold tnum ${total >= 0 ? "text-up" : "text-down"}`}>
                    {total >= 0 ? "+" : "−"}
                    {Math.abs(total * 100).toFixed(1)}%
                  </div>
                  <div className="eyebrow">total return</div>
                </div>
              }
            />
            <div className="px-3 pb-4">
              <EquityChart data={equity_curve} holdoutFrom={meta.holdoutFrom} />
            </div>
          </Panel>
        )}
        <div className="reveal flex flex-col [&>*]:flex-1" style={d(6)}>
          <PlatformFit benchmarks={analysis.benchmarks} metrics={result.metrics} />
        </div>
      </div>

      <div className="grid-2-1">
        {ic_series.length > 0 && (
          <Panel className="reveal" style={d(7)}>
            <PanelHeader
              title="Information coefficient"
              hint="Daily rank correlation between the signal and what happened next."
              right={<InfoTip text="IC measures whether the signal ranks winners above losers. Bars are single days; the line smooths them." focus="IC" />}
            />
            <div className="px-3 pb-4">
              <ICChart data={ic_series} />
            </div>
          </Panel>
        )}
        {quantile_returns.length > 0 && (
          <Panel className="reveal flex flex-col overflow-hidden" style={d(8)}>
            <PanelHeader title="Returns by quintile" hint="Q1 is the lowest-ranked fifth (shorted), Q5 the highest (long). A real signal climbs left to right." />
            <div className="px-3">
              <QuantileChart data={quantile_returns} />
            </div>
            <div className="mt-auto grid grid-cols-2 gap-px border-t border-white/[0.07] bg-white/[0.07]">
              <div className="bg-[#0d0d10] px-5 py-3">
                <div className="eyebrow">Q5 − Q1 spread</div>
                <div className={`mt-1 font-mono text-base font-semibold tnum ${q.spread >= 0 ? "text-up" : "text-down"}`}>
                  {q.spread >= 0 ? "+" : "−"}
                  {Math.abs(q.spread * 100).toFixed(2)}%
                </div>
              </div>
              <div className="rounded-br-2xl bg-[#0d0d10] px-5 py-3">
                <div className="eyebrow">Monotonic</div>
                <div className="mt-1 font-mono text-base font-semibold tnum text-white">{Math.round(q.monotonicity * 100)}%</div>
              </div>
            </div>
          </Panel>
        )}
      </div>

      <div className="grid-2-1">
        {equity_curve.length > 0 && (
          <div className="reveal" style={d(9)}>
            <MonthlyHeatmap equity={equity_curve} />
          </div>
        )}
        <div className="reveal flex flex-col [&>*]:flex-1" style={d(10)}>
          <Regimes regimes={analysis.regimes} />
        </div>
      </div>

      <div className="reveal" style={d(11)}>
        <Insights analysis={analysis} />
      </div>

      {feature_importance && feature_importance.length > 0 && (
        <Panel className="reveal" style={d(12)}>
          <PanelHeader title="Feature importance" hint="Which inputs the model leaned on, from the LightGBM fit." />
          <div className="px-3 pb-4">
            <FeatureImportanceChart data={feature_importance} />
          </div>
        </Panel>
      )}

      <p className="mx-auto max-w-2xl pt-2 text-center text-[11px] leading-relaxed text-gray-600">
        Backtests are hypothetical and gross of transaction costs. Past performance does not predict future results. Nothing here is investment advice.
      </p>
    </div>
  );
}
