import type { QuantileReturn, TimeSeriesPoint } from "./types";

export interface Pt {
  date: string;
  value: number;
}

export function clean(series: TimeSeriesPoint[]): Pt[] {
  return series.filter((p): p is Pt => p.value !== null && Number.isFinite(p.value));
}

/** Underwater curve: NAV / running-peak − 1 */
export function drawdownSeries(equity: Pt[]): Pt[] {
  let peak = -Infinity;
  return equity.map((p) => {
    peak = Math.max(peak, p.value);
    return { date: p.date, value: p.value / peak - 1 };
  });
}

export function rollingMean(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i >= window - 1 ? sum / window : null);
  }
  return out;
}

export interface IcBar {
  date: string;
  v: number;
  pos: number | null;
  neg: number | null;
  roll: number | null;
}

export function icBars(ic: Pt[], window = 60): IcBar[] {
  const roll = rollingMean(
    ic.map((p) => p.value),
    window
  );
  return ic.map((p, i) => ({
    date: p.date,
    v: p.value,
    pos: p.value >= 0 ? p.value : null,
    neg: p.value < 0 ? p.value : null,
    roll: roll[i],
  }));
}

export interface MonthlyRow {
  year: number;
  months: (number | null)[];
  total: number;
}

export interface MonthlyTable {
  rows: MonthlyRow[];
  maxAbs: number;
  best: { label: string; value: number } | null;
  worst: { label: string; value: number } | null;
  positiveShare: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthlyReturns(equity: Pt[]): MonthlyTable {
  if (equity.length < 2) return { rows: [], maxAbs: 0, best: null, worst: null, positiveShare: 0 };

  // last NAV of each calendar month, in order
  const ends: { y: number; m: number; nav: number }[] = [];
  for (const p of equity) {
    const y = +p.date.slice(0, 4);
    const m = +p.date.slice(5, 7) - 1;
    const last = ends[ends.length - 1];
    if (last && last.y === y && last.m === m) last.nav = p.value;
    else ends.push({ y, m, nav: p.value });
  }

  const byYear = new Map<number, (number | null)[]>();
  let prevNav = equity[0].value;
  let maxAbs = 0;
  let best: MonthlyTable["best"] = null;
  let worst: MonthlyTable["worst"] = null;
  let positives = 0;
  let count = 0;

  for (const e of ends) {
    const r = e.nav / prevNav - 1;
    prevNav = e.nav;
    if (!byYear.has(e.y)) byYear.set(e.y, Array(12).fill(null));
    byYear.get(e.y)![e.m] = r;
    maxAbs = Math.max(maxAbs, Math.abs(r));
    const label = `${MONTHS[e.m]} ${e.y}`;
    if (!best || r > best.value) best = { label, value: r };
    if (!worst || r < worst.value) worst = { label, value: r };
    if (r > 0) positives++;
    count++;
  }

  // calendar-year totals
  const yearEndNav = new Map<number, number>();
  for (const e of ends) yearEndNav.set(e.y, e.nav);
  const years = Array.from(byYear.keys()).sort((a, b) => a - b);
  let prevYearNav = equity[0].value;
  const rows: MonthlyRow[] = years.map((year) => {
    const end = yearEndNav.get(year)!;
    const total = end / prevYearNav - 1;
    prevYearNav = end;
    return { year, months: byYear.get(year)!, total };
  });

  return { rows, maxAbs, best, worst, positiveShare: count ? positives / count : 0 };
}

export const MONTH_LABELS = MONTHS;

export function quantileStats(q: QuantileReturn[]) {
  if (q.length < 2) return { spread: 0, monotonicity: 0 };
  const spread = q[q.length - 1].mean_return - q[0].mean_return;
  let up = 0;
  for (let i = 1; i < q.length; i++) if (q[i].mean_return >= q[i - 1].mean_return) up++;
  return { spread, monotonicity: up / (q.length - 1) };
}

/** First trading day of each calendar year, for clean x-axis ticks */
export function yearTicks(points: { date: string }[]): string[] {
  const seen = new Set<string>();
  const ticks: string[] = [];
  for (const p of points) {
    const y = p.date.slice(0, 4);
    if (!seen.has(y)) {
      seen.add(y);
      ticks.push(p.date);
    }
  }
  return ticks;
}

export function yearLabel(date: string): string {
  return date.slice(0, 4);
}

export function longDate(date: string): string {
  const y = date.slice(0, 4);
  const m = +date.slice(5, 7) - 1;
  const d = +date.slice(8, 10);
  return `${MONTHS[m]} ${d}, ${y}`;
}
