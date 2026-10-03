/**
 * Rule-based alpha signal analysis.
 * Produces classification tags, diagnosis text, regime breakdown,
 * and competitive benchmark scores — all from backtest output alone.
 */

import type { BacktestResponse, BacktestMetrics, TimeSeriesPoint } from "./types";

export interface SignalTag {
  label: string;
  color: "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet";
}

export interface RegimeBreakdown {
  label: string;
  icMean: number;
  sharpe: number;
  nDays: number;
  assessment: "strong" | "weak" | "neutral" | "negative";
}

export interface CompetitiveBenchmark {
  platform: string;
  metric: string;
  yourValue: number;
  threshold: number;
  description: string;
  passes: boolean;
}

export interface SignalAnalysis {
  tags: SignalTag[];
  headline: string;
  diagnosis: string[];
  regimes: RegimeBreakdown[];
  benchmarks: CompetitiveBenchmark[];
  suggestions: string[];
}

// ── Classification ─────────────────────────────────────────────────────────

export function classifySignal(
  metrics: BacktestMetrics,
  icSeries: TimeSeriesPoint[],
  expression?: string
): SignalTag[] {
  const tags: SignalTag[] = [];
  const ic = metrics.ic_mean;
  const icir = metrics.ic_ir;
  const turnover = metrics.avg_daily_turnover;

  // Direction
  if (ic > 0.01) tags.push({ label: "Predictive", color: "emerald" });
  else if (ic < -0.01) tags.push({ label: "Inverse Signal", color: "rose" });
  else tags.push({ label: "Noisy", color: "amber" });

  // Style — infer from expression keywords if available
  const expr = (expression ?? "").toLowerCase();
  if (expr.includes("delta") || expr.includes("delay") || expr.includes("ts_mean")) {
    tags.push({ label: expr.includes("reversal") ? "Mean Reversion" : "Time-Series", color: "indigo" });
  }
  if (expr.includes("corr")) tags.push({ label: "Cross-Corr", color: "violet" });
  if (expr.includes("group_neutralize") || expr.includes("sector")) {
    tags.push({ label: "Sector Neutral", color: "sky" });
  }
  if (expr.includes("volume")) tags.push({ label: "Volume", color: "sky" });

  // Turnover regime
  if (turnover > 0.5) tags.push({ label: "High Turnover", color: "amber" });
  else if (turnover < 0.15) tags.push({ label: "Low Turnover", color: "emerald" });

  // IC consistency
  const icValues = icSeries.map((p) => p.value).filter((v): v is number => v !== null);
  const icStd = stdDev(icValues);
  if (icir > 0.1) tags.push({ label: "Consistent", color: "emerald" });
  else if (Math.abs(ic) > 0 && icStd > 0.3) tags.push({ label: "Volatile IC", color: "amber" });

  return tags.slice(0, 4); // cap at 4 tags
}

// ── Diagnosis ──────────────────────────────────────────────────────────────

export function generateDiagnosis(
  metrics: BacktestMetrics,
  icSeries: TimeSeriesPoint[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _expression?: string
): { headline: string; lines: string[] } {
  const { ic_mean, ic_ir, sharpe, max_drawdown, avg_daily_turnover } = metrics;
  const lines: string[] = [];

  // IC quality
  if (Math.abs(ic_mean) < 0.005) {
    lines.push(
      "Near-zero IC mean indicates the signal has no systematic relationship with forward returns — likely capturing noise rather than return predictability."
    );
  } else if (ic_mean > 0.02) {
    lines.push(
      `IC mean of ${fmt4(ic_mean)} is in publishable territory. Signals above 0.02 are considered actionable in the academic literature.`
    );
  } else if (ic_mean < -0.01) {
    lines.push(
      `Negative IC mean (${fmt4(ic_mean)}) means the signal predicts returns in the wrong direction. Negating the expression may recover value — WorldQuant practitioners routinely flip sign as a first adjustment.`
    );
  } else {
    lines.push(
      `IC mean of ${fmt4(ic_mean)} is below the typical 0.02 threshold for competitive submissions. Signal has weak predictive content.`
    );
  }

  // IC-IR (consistency)
  if (Math.abs(ic_ir) < 0.05) {
    lines.push(
      `IC-IR of ${fmt2(ic_ir)} signals low consistency — the alpha's predictive power varies substantially across time periods. Purging look-ahead bias or extending the lookback window may stabilize it.`
    );
  } else if (ic_ir > 0.1) {
    lines.push(
      `IC-IR of ${fmt2(ic_ir)} indicates the signal is consistent across periods, a key criterion for Numerai and WorldQuant BRAIN submissions.`
    );
  }

  // Turnover
  if (avg_daily_turnover > 0.5) {
    lines.push(
      `Daily turnover of ${pct(avg_daily_turnover)} is high for a real portfolio — transaction costs would erode most of the gross alpha. Consider adding a ts_decay_linear() wrapper to reduce churn.`
    );
  }

  // Drawdown
  if (max_drawdown < -0.30) {
    lines.push(
      `Maximum drawdown of ${pct(max_drawdown)} exceeds typical risk limits (−20% is a common institutional threshold). The signal may benefit from volatility scaling or position limits.`
    );
  }

  // Market regime context (2020–2024 is a known momentum market)
  const icValues = icSeries.map((p) => p.value).filter((v): v is number => v !== null);
  const midpoint = Math.floor(icValues.length / 2);
  const earlyIC = mean(icValues.slice(0, midpoint));
  const lateIC = mean(icValues.slice(midpoint));
  if (Math.abs(earlyIC - lateIC) > 0.02) {
    const direction = earlyIC > lateIC ? "declined" : "improved";
    lines.push(
      `Signal strength ${direction} over the test period (early IC: ${fmt4(earlyIC)}, late IC: ${fmt4(lateIC)}). This is consistent with the factor regime shift from low-rate growth (2020–2021) to rate-sensitive value (2022–2024).`
    );
  }

  // Headline
  let headline = "";
  if (ic_ir > 0.1 && ic_mean > 0.02) headline = "Competitive signal with strong consistency";
  else if (ic_mean < -0.01) headline = "Inverse relationship detected — consider negating";
  else if (Math.abs(ic_mean) < 0.005) headline = "Signal is statistically indistinguishable from noise";
  else if (sharpe < -0.5) headline = "Negative Sharpe in trending market — factor regime mismatch likely";
  else headline = "Weak signal — incremental refinement suggested";

  return { headline, lines };
}

// ── Regime Breakdown ───────────────────────────────────────────────────────

export function computeRegimes(icSeries: TimeSeriesPoint[]): RegimeBreakdown[] {
  const valid = icSeries.filter((p) => p.value !== null) as { date: string; value: number }[];
  if (valid.length < 20) return [];

  const third = Math.floor(valid.length / 3);
  const chunks = [
    { points: valid.slice(0, third), label: periodLabel(valid.slice(0, third)) },
    { points: valid.slice(third, 2 * third), label: periodLabel(valid.slice(third, 2 * third)) },
    { points: valid.slice(2 * third), label: periodLabel(valid.slice(2 * third)) },
  ];

  return chunks.map(({ points, label }) => {
    const icMean = mean(points.map((p) => p.value));
    const icStd = stdDev(points.map((p) => p.value));
    const approxSharpe = icStd > 0 ? (icMean / icStd) * Math.sqrt(252) : 0;
    const assessment: RegimeBreakdown["assessment"] =
      icMean > 0.02 ? "strong" : icMean > 0.005 ? "neutral" : icMean < -0.01 ? "negative" : "weak";
    return { label, icMean, sharpe: approxSharpe, nDays: points.length, assessment };
  });
}

// ── Competitive Benchmarks ─────────────────────────────────────────────────

export function computeBenchmarks(metrics: BacktestMetrics): CompetitiveBenchmark[] {
  return [
    {
      platform: "Numerai",
      metric: "IC Mean",
      yourValue: metrics.ic_mean,
      threshold: 0.02,
      description: "Rule-of-thumb floor (~0.02) for a signal worth trading. Not an official Numerai requirement.",
      passes: metrics.ic_mean > 0.02,
    },
    {
      platform: "Numerai",
      metric: "IC-IR",
      yourValue: metrics.ic_ir,
      threshold: 0.1,
      description: "Rule of thumb on the daily series: IC-IR above ~0.1 (about 1.6 annualized) suggests a steady signal. Numerai rewards consistency, but this is not an official Numerai cutoff.",
      passes: metrics.ic_ir > 0.1,
    },
    {
      platform: "WorldQuant",
      metric: "Sharpe",
      yourValue: metrics.sharpe,
      threshold: 1.0,
      description: "Rule-of-thumb floor for a BRAIN alpha worth submitting. BRAIN's own submission checks are stricter and change over time.",
      passes: metrics.sharpe > 1.0,
    },
    {
      platform: "WorldQuant",
      metric: "Fitness",
      yourValue: estimateFitness(metrics),
      threshold: 1.0,
      description: "Estimated with WorldQuant's published formula: Sharpe × √(|Returns| / max(Turnover, 0.125)). Uses local returns and turnover, so treat it as a preview of the BRAIN score.",
      passes: estimateFitness(metrics) > 1.0,
    },
  ];
}

export function estimateFitness(metrics: BacktestMetrics): number {
  const turnover = Math.max(metrics.avg_daily_turnover, 0.125);
  return metrics.sharpe * Math.sqrt(Math.abs(metrics.annual_return) / turnover);
}

// ── Suggestions ────────────────────────────────────────────────────────────

export function generateSuggestions(metrics: BacktestMetrics, expression?: string): string[] {
  const suggestions: string[] = [];
  const expr = expression ?? "";

  if (metrics.ic_mean < 0 && metrics.ic_mean > -0.05) {
    suggestions.push(`Try negating: rank(-1 * (${expr}))`);
  }
  if (metrics.avg_daily_turnover > 0.4 && !expr.includes("ts_decay")) {
    suggestions.push("Wrap with ts_decay_linear(·, 5) to reduce daily rebalancing turnover");
  }
  if (!expr.includes("group_neutral") && !expr.includes("sector")) {
    suggestions.push("Add sector neutralization: group_neutralize(·, sector)");
  }
  if (metrics.ic_ir < 0.05 && !expr.includes("ts_mean")) {
    suggestions.push("Smooth the signal: ts_mean(·, 5) can reduce IC volatility");
  }
  if (Math.abs(metrics.ic_mean) < 0.005) {
    suggestions.push("Combine with a second orthogonal signal to extract hidden predictive content");
  }

  return suggestions.slice(0, 3);
}

// ── Full analysis ──────────────────────────────────────────────────────────

export function analyzeResult(result: BacktestResponse): SignalAnalysis {
  const { headline, lines } = generateDiagnosis(result.metrics, result.ic_series, result.expression);
  return {
    tags: classifySignal(result.metrics, result.ic_series, result.expression),
    headline,
    diagnosis: lines,
    regimes: computeRegimes(result.ic_series),
    benchmarks: computeBenchmarks(result.metrics),
    suggestions: generateSuggestions(result.metrics, result.expression),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function periodLabel(points: { date: string }[]): string {
  if (!points.length) return "";
  const start = points[0].date.slice(0, 7);
  const end = points[points.length - 1].date.slice(0, 7);
  return `${start} – ${end}`;
}

function fmt4(n: number): string {
  return n.toFixed(4);
}
function fmt2(n: number): string {
  return n.toFixed(2);
}
function pct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}
