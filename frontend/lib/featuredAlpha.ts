/**
 * Pre-loaded demo result for the landing experience.
 * All data is deterministic and generated client-side — no API needed.
 */
import type { BacktestResponse } from "./types";

// Seeded LCG — deterministic, same output on every run
function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function boxMuller(r: () => number, mean: number, std: number): number {
  const u1 = Math.max(r(), 1e-10);
  const u2 = r();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function tradingDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T12:00:00Z");
  const fin = new Date(end + "T12:00:00Z");
  while (cur <= fin) {
    const d = cur.getUTCDay();
    if (d !== 0 && d !== 6) dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function generateFeaturedAlpha(): BacktestResponse {
  const r = makePrng(0xdeadbeef);
  const dates = tradingDates("2020-01-02", "2024-12-31");
  const n = dates.length;

  // IC series: AR(1) — stationary mean ~0.026, std ~0.040
  const icRaw: number[] = [];
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const shock = boxMuller(r, 0, 0.0394);
    prev = 0.18 * prev + 0.02132 + shock;
    icRaw.push(prev);
  }

  // Equity curve: daily L/S PnL, in %-units (divided by 100 when applied).
  // A mid-2022 factor drawdown (lower edge, higher vol) keeps the curve believable.
  const equityCurve: number[] = [100];
  for (let i = 0; i < n; i++) {
    const rough = dates[i] >= "2022-02-01" && dates[i] <= "2022-09-30";
    const dailyRet = rough ? boxMuller(r, -0.05, 0.85) : boxMuller(r, 0.066, 0.62);
    equityCurve.push(equityCurve[equityCurve.length - 1] * (1 + dailyRet / 100));
  }

  // Turnover series
  const turnoverSeries = dates.map(() => Math.max(0.22, Math.min(0.7, boxMuller(r, 0.4, 0.05))));

  // Derived metrics
  const icMean = icRaw.reduce((a, b) => a + b, 0) / n;
  const icVar = icRaw.reduce((a, v) => a + (v - icMean) ** 2, 0) / (n - 1);
  const icStd = Math.sqrt(icVar);
  const icIR = icMean / icStd;

  // Max drawdown
  let peak = equityCurve[0];
  let maxDD = 0;
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    const dd = (v - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }

  const annReturn = (equityCurve[n] / equityCurve[0]) ** (252 / n) - 1;

  const dailyRets = equityCurve.slice(1).map((v, i) => v / equityCurve[i] - 1);
  const retMean = dailyRets.reduce((a, b) => a + b, 0) / dailyRets.length;
  const retStd = Math.sqrt(dailyRets.reduce((a, v) => a + (v - retMean) ** 2, 0) / dailyRets.length);
  const sharpe = (retMean / retStd) * Math.sqrt(252);

  const downside = Math.sqrt(
    dailyRets.filter((v) => v < 0).reduce((a, v) => a + v * v, 0) /
      dailyRets.filter((v) => v < 0).length
  );
  const sortino = (retMean / downside) * Math.sqrt(252);
  const hitRate = icRaw.filter((v) => v > 0).length / n;

  return {
    metrics: {
      annual_return: annReturn,
      sharpe,
      sortino,
      max_drawdown: maxDD,
      ic_mean: icMean,
      ic_std: icStd,
      ic_ir: icIR,
      hit_rate: hitRate,
      avg_daily_turnover: turnoverSeries.reduce((a, b) => a + b) / n,
      n_trading_days: n,
    },
    ic_series: dates.map((date, i) => ({ date, value: icRaw[i] })),
    equity_curve: dates.map((date, i) => ({ date, value: equityCurve[i + 1] })),
    daily_pnl: dates.map((date, i) => ({ date, value: equityCurve[i + 1] - equityCurve[i] })),
    turnover: dates.map((date, i) => ({ date, value: turnoverSeries[i] })),
    quantile_returns: [
      { quantile: "Q1 (short)", mean_return: -0.00192 },
      { quantile: "Q2", mean_return: -0.00071 },
      { quantile: "Q3", mean_return: 0.00018 },
      { quantile: "Q4", mean_return: 0.00094 },
      { quantile: "Q5 (long)", mean_return: 0.00231 },
    ],
    expression: "group_neutralize(rank(-returns), sector)",
    elapsed_seconds: 0,
  };
}

export const FEATURED_ALPHA: BacktestResponse = generateFeaturedAlpha();
