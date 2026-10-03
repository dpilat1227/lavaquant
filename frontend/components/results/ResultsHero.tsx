"use client";

import { BookmarkCheck, Check, Copy, Link2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { InfoTip } from "@/components/ui/InfoTip";
import { Expr } from "@/components/ui/Expr";
import { ScoreRing } from "./ScoreRing";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { METRIC_BY_KEY } from "@/lib/metrics";
import { useCountUp } from "@/lib/useCountUp";
import { buildAlphaLink, buildSummary, copyText } from "@/lib/share";
import { emit, toast } from "@/lib/bus";
import type { Score } from "@/lib/score";
import type { SignalAnalysis, SignalTag } from "@/lib/analysis";
import type { BacktestResponse } from "@/lib/types";
import type { ResultMeta } from "@/lib/bus";

type Zone = "bad" | "warn" | "ok" | "great";
const ZONE: Record<Zone, string> = { bad: "#ff5470", warn: "#ffc857", ok: "#7cc4ff", great: "#3ddc97" };

// Blue for everything informational (verdicts and descriptors); amber/rose only for warnings.
const INFO = { fg: "#93d2ff", rgb: "110,168,255" };
const TAG_COLOR: Record<SignalTag["color"], { fg: string; rgb: string }> = {
  indigo: INFO,
  emerald: INFO,
  sky: INFO,
  violet: INFO,
  amber: { fg: "#ffd37a", rgb: "255,200,87" },
  rose: { fg: "#ff8aa0", rgb: "255,84,112" },
};

interface Kpi {
  key: string;
  label: string;
  value: number;
  format: (v: number) => string;
  /** Gauge fill is computed from `gauge` (defaults to value) across [lo, hi] */
  gauge?: number;
  lo: number;
  hi: number;
  target?: number;
  caption: string;
  zone: Zone;
  negative?: boolean;
}

const pct = (d: number) => (v: number) => `${(v * 100).toFixed(d)}%`;

function buildKpis(m: BacktestResponse["metrics"]): Kpi[] {
  return [
    {
      key: "Sharpe", label: "Sharpe", value: m.sharpe, format: (v) => v.toFixed(2), lo: 0, hi: 3, target: 1,
      caption: "target ≥ 1.0", zone: m.sharpe < 0 ? "bad" : m.sharpe < 0.5 ? "warn" : m.sharpe < 1 ? "ok" : "great",
      negative: m.sharpe < 0,
    },
    {
      key: "Annual Return", label: "Annual return", value: m.annual_return, format: pct(1), lo: 0, hi: 0.3,
      caption: "gross of costs", zone: m.annual_return < 0 ? "bad" : m.annual_return < 0.05 ? "warn" : m.annual_return < 0.15 ? "ok" : "great",
      negative: m.annual_return < 0,
    },
    {
      key: "IC-IR", label: "IC-IR", value: m.ic_ir, format: (v) => v.toFixed(2), lo: 0, hi: 0.2, target: 0.1,
      caption: "target ≥ 0.1", zone: m.ic_ir < 0 ? "bad" : m.ic_ir < 0.05 ? "warn" : m.ic_ir < 0.1 ? "ok" : "great",
      negative: m.ic_ir < 0,
    },
    {
      key: "Avg Turnover", label: "Turnover", value: m.avg_daily_turnover, format: pct(0), lo: 0, hi: 1, target: 0.7,
      caption: "BRAIN limit 70%", zone: m.avg_daily_turnover < 0.3 ? "great" : m.avg_daily_turnover < 0.7 ? "ok" : m.avg_daily_turnover < 1.2 ? "warn" : "bad",
    },
    {
      key: "Max DD", label: "Max DD", value: m.max_drawdown, format: pct(1), gauge: Math.abs(m.max_drawdown), lo: 0, hi: 0.3, target: 0.2,
      caption: "limit −20%", zone: m.max_drawdown > -0.1 ? "great" : m.max_drawdown > -0.2 ? "ok" : m.max_drawdown > -0.3 ? "warn" : "bad",
      negative: true,
    },
    {
      key: "Hit Rate", label: "Hit rate", value: m.hit_rate, format: pct(0), lo: 0.4, hi: 0.7, target: 0.5,
      caption: "needs > 50%", zone: m.hit_rate < 0.45 ? "bad" : m.hit_rate < 0.5 ? "warn" : m.hit_rate < 0.55 ? "ok" : "great",
    },
  ];
}

function KpiCell({ k, index }: { k: Kpi; index: number }) {
  const shown = useCountUp(k.value, 1200);
  const g = k.gauge ?? k.value;
  const fill = Math.max(0, Math.min(1, (g - k.lo) / (k.hi - k.lo)));
  const tickAt = k.target !== undefined ? Math.max(0, Math.min(1, (k.target - k.lo) / (k.hi - k.lo))) : null;
  const color = ZONE[k.zone];
  const doc = METRIC_BY_KEY[k.key];

  return (
    <div className="reveal bg-[#0d0d10] px-5 py-4" style={{ ["--i" as string]: index + 3 }}>
      <div className="flex items-center gap-1.5">
        <span className="eyebrow whitespace-nowrap">{k.label}</span>
        {doc && <InfoTip text={doc.short} focus={doc.key} />}
      </div>
      <div className="mt-2 text-[30px] font-semibold leading-none tracking-tight tnum" style={{ color: k.negative && k.key !== "Max DD" ? ZONE.bad : "#fff" }}>
        {k.format(shown)}
      </div>
      <div className="relative mt-3 h-1 rounded-full bg-white/[0.07]">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${fill * 100}%`,
            background: color,
            transition: "width 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
        {tickAt !== null && <div className="absolute -top-[3px] h-[10px] w-px bg-white/45" style={{ left: `${tickAt * 100}%` }} />}
      </div>
      <div className="mt-1.5 font-mono text-[10.5px] text-gray-500">{k.caption}</div>
    </div>
  );
}

function GhostButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-gray-400 transition-colors hover:border-white/15 hover:bg-white/[0.07] hover:text-white"
    >
      {icon}
      {children}
    </button>
  );
}

interface Props {
  result: BacktestResponse;
  analysis: SignalAnalysis;
  score: Score;
  meta: ResultMeta;
}

export function ResultsHero({ result, analysis, score, meta }: Props) {
  const sample = meta.source === "sample";
  const m = result.metrics;
  const kpis = buildKpis(m);
  const [copied, setCopied] = useState(false);

  async function copyExpr() {
    if (!result.expression) return;
    if (await copyText(result.expression)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  }

  return (
    <Panel spotlight className="overflow-hidden">
      {/* ambient glow keyed to the score tier */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl animate-drift"
        style={{ background: `radial-gradient(circle, ${score.color}, transparent 70%)` }}
      />

      <div className="relative px-6 pb-6 pt-5">
        {/* meta row */}
        <div className="reveal mb-5 flex flex-wrap items-center justify-between gap-3" style={{ ["--i" as string]: 0 }}>
          {sample ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help items-center gap-2 rounded-full border border-lava-500/30 bg-lava-500/10 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-lava-300">
                  <Sparkles className="h-3 w-3" /> Sample result · simulated data
                </span>
              </TooltipTrigger>
              <TooltipContent>
                This preloaded result is generated from synthetic data to show what the dashboard looks like. Run a backtest on the left for real numbers.
              </TooltipContent>
            </Tooltip>
          ) : meta.source === "saved" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sky-300">
                  <BookmarkCheck className="h-3 w-3" /> Saved backtest · {meta.note}
                </span>
              </TooltipTrigger>
              <TooltipContent>A real backtest saved from the engine, so it loads instantly. The shaded part of the equity curve is the holdout period the alpha was never selected on.</TooltipContent>
            </Tooltip>
          ) : (
            <span className="flex items-center gap-2 rounded-full border border-up/25 bg-up/10 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-up">
              <span className="h-1.5 w-1.5 rounded-full bg-up animate-breathe" /> Backtest complete · {m.n_trading_days.toLocaleString()} days · {result.elapsed_seconds.toFixed(1)}s
            </span>
          )}
          <div className="flex items-center gap-2">
            {result.expression && (
              <GhostButton
                onClick={async () => {
                  if (await copyText(buildAlphaLink(result.expression!))) toast("Link copied. Anyone can open this alpha in the editor.");
                }}
                icon={<Link2 className="h-3 w-3" />}
              >
                Copy link
              </GhostButton>
            )}
            <GhostButton
              onClick={async () => {
                if (await copyText(buildSummary(result))) toast("Summary copied to clipboard");
              }}
              icon={<Copy className="h-3 w-3" />}
            >
              Copy summary
            </GhostButton>
          </div>
        </div>

        <div className="hero-grid items-center">
          <div className="min-w-0">
            <h2 className="reveal text-balance text-[28px] font-semibold leading-[1.15] tracking-tight text-white" style={{ ["--i" as string]: 1 }}>
              {analysis.headline}
            </h2>

            {result.expression && (
              <div className="reveal mt-4 flex items-center gap-2" style={{ ["--i" as string]: 2 }}>
                <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-[13px] leading-snug shadow-[inset_0_1px_6px_rgba(0,0,0,0.5)]">
                  <Expr code={result.expression} className="whitespace-nowrap" />
                </div>
                <button
                  onClick={copyExpr}
                  aria-label="Copy expression"
                  className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-white"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-up" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}

            <div className="reveal mt-4 flex flex-wrap gap-1.5" style={{ ["--i" as string]: 3 }}>
              {analysis.tags.map((t) => (
                <span
                  key={t.label}
                  className="rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{
                    color: TAG_COLOR[t.color].fg,
                    background: `rgba(${TAG_COLOR[t.color].rgb}, 0.16)`,
                    borderColor: `rgba(${TAG_COLOR[t.color].rgb}, 0.4)`,
                  }}
                >
                  {t.label}
                </span>
              ))}
            </div>

            <div className="reveal mt-6 grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3" style={{ ["--i" as string]: 4 }}>
              {score.parts.map((p) => (
                <div key={p.key} title={`${p.label}: ${Math.round(p.value * 100)}% of ${Math.round(p.weight * 100)} points (${p.detail})`}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[11px] text-gray-500">{p.label}</span>
                    <span className="font-mono text-[10px] text-gray-600">{Math.round(p.value * p.weight * 100)}/{Math.round(p.weight * 100)}</span>
                  </div>
                  <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p.value * 100}%`,
                        background: score.color,
                        transition: "width 1.4s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="reveal flex flex-col items-center" style={{ ["--i" as string]: 2 }}>
            <ScoreRing score={score} />
            <button
              onClick={() => emit("open-docs", { tab: "metrics", focus: "Score" })}
              className="mt-1 text-[10.5px] text-gray-600 transition-colors hover:text-lava-400"
            >
              How is this scored?
            </button>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="hairline-grid border-t border-white/[0.07]">
        {kpis.map((k, i) => (
          <KpiCell key={k.key} k={k} index={i} />
        ))}
      </div>

      <div className="reveal flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-white/[0.07] bg-black/20 px-6 py-2.5 font-mono text-[11px] text-gray-500" style={{ ["--i" as string]: 9 }}>
        <span>
          Sortino <span className="text-gray-300">{m.sortino.toFixed(2)}</span>
        </span>
        <span>
          IC mean <span className="text-gray-300">{m.ic_mean.toFixed(4)}</span>
        </span>
        <span>
          IC σ <span className="text-gray-300">{m.ic_std.toFixed(4)}</span>
        </span>
        <span>
          Sample <span className="text-gray-300">{m.n_trading_days.toLocaleString()} trading days</span>
        </span>
      </div>
    </Panel>
  );
}
