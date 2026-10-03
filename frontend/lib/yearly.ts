import type { BacktestResponse } from "./types";
import { clean } from "./derive";

export interface YearRow {
  label: string;
  days: number;
  sharpe: number;
  turnover: number;
  fitness: number;
  ret: number;
  drawdown: number;
  icMean: number | null;
}

function stats(pnl: number[], turnover: number[], ic: number[], label: string): YearRow {
  const n = pnl.length;
  const mean = pnl.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(pnl.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(n - 1, 1));
  const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(252) : 0;
  let nav = 1;
  let peak = 1;
  let dd = 0;
  for (const p of pnl) {
    nav *= 1 + p;
    peak = Math.max(peak, nav);
    dd = Math.min(dd, nav / peak - 1);
  }
  const ret = nav ** (252 / n) - 1;
  const t = turnover.length ? turnover.reduce((a, b) => a + b, 0) / turnover.length : 0;
  const fitness = sharpe * Math.sqrt(Math.abs(ret) / Math.max(t, 0.125));
  return { label, days: n, sharpe, turnover: t, fitness, ret, drawdown: dd, icMean: ic.length ? ic.reduce((a, b) => a + b, 0) / ic.length : null };
}

/** Year-by-year breakdown, same columns as BRAIN's IS summary (minus margin and position counts). */
export function yearlyStats(r: BacktestResponse): YearRow[] {
  // daily returns come from the equity curve, which every result carries (saved ones drop the raw pnl series)
  const eq = clean(r.equity_curve);
  const pnl = eq.slice(1).map((p, i) => ({ date: p.date, value: p.value / eq[i].value - 1 }));
  const turn = clean(r.turnover);
  const avgTurn = r.metrics.avg_daily_turnover;
  const ic = clean(r.ic_series);
  if (pnl.length < 20) return [];
  const years = Array.from(new Set(pnl.map((p) => p.date.slice(0, 4)))).sort();
  const rows = years.map((y) =>
    stats(
      pnl.filter((p) => p.date.startsWith(y)).map((p) => p.value),
      turn.length ? turn.filter((p) => p.date.startsWith(y)).map((p) => p.value) : [avgTurn],
      ic.filter((p) => p.date.startsWith(y)).map((p) => p.value),
      y
    )
  );
  const all = stats(pnl.map((p) => p.value), turn.length ? turn.map((p) => p.value) : [avgTurn], ic.map((p) => p.value), "All");
  return [all, ...rows.filter((x) => x.days >= 20)];
}
