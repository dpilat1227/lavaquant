import type { BacktestMetrics } from "./types";

export type Tier = "Elite" | "Strong" | "Promising" | "Marginal" | "Weak";

export interface ScorePart {
  key: string;
  label: string;
  weight: number;
  /** 0..1 */
  value: number;
  detail: string;
}

export interface Score {
  score: number;
  tier: Tier;
  /** CSS color for the tier */
  color: string;
  parts: ScorePart[];
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * lavaquant score: a transparent 0–100 heuristic that blends signal quality,
 * risk-adjusted performance and tradeability. It is NOT a WorldQuant or Numerai metric.
 */
export function computeScore(m: BacktestMetrics): Score {
  const parts: ScorePart[] = [
    { key: "sharpe", label: "Sharpe", weight: 0.3, value: clamp01(m.sharpe / 2.5), detail: "2.5 = full marks" },
    { key: "icir", label: "IC-IR", weight: 0.25, value: clamp01(m.ic_ir / 0.2), detail: "0.2 = full marks" },
    { key: "ic", label: "IC strength", weight: 0.15, value: clamp01(m.ic_mean / 0.04), detail: "0.04 = full marks" },
    { key: "hit", label: "Hit rate", weight: 0.1, value: clamp01((m.hit_rate - 0.5) / 0.1), detail: "60% = full marks" },
    { key: "dd", label: "Drawdown", weight: 0.1, value: clamp01(1 - Math.abs(m.max_drawdown) / 0.3), detail: "0% = full marks" },
    { key: "turn", label: "Turnover", weight: 0.1, value: clamp01(1 - (m.avg_daily_turnover - 0.15) / 0.45), detail: "≤15% = full marks" },
  ];
  const score = Math.round(parts.reduce((a, p) => a + p.weight * p.value, 0) * 100);
  const tier: Tier = score >= 80 ? "Elite" : score >= 62 ? "Strong" : score >= 45 ? "Promising" : score >= 28 ? "Marginal" : "Weak";
  const color =
    tier === "Elite" ? "#3ddc97" : tier === "Strong" ? "#8be08a" : tier === "Promising" ? "#ffc857" : tier === "Marginal" ? "#ff8049" : "#ff5470";
  return { score, tier, color, parts };
}
