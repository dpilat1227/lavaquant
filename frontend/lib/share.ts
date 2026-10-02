import type { BacktestResponse } from "./types";
import { computeScore } from "./score";

export function buildAlphaLink(expression: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("alpha", expression);
  return url.toString();
}

export function readAlphaParam(): string | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("alpha");
  return v && v.trim() ? v.trim().slice(0, 600) : null;
}

export function buildSummary(r: BacktestResponse): string {
  const m = r.metrics;
  const s = computeScore(m);
  const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
  return [
    `lavaquant backtest${r.expression ? ` · ${r.expression}` : ""}`,
    `Score ${s.score}/100 (${s.tier})`,
    `Sharpe ${m.sharpe.toFixed(2)} · Sortino ${m.sortino.toFixed(2)} · Annual return ${pct(m.annual_return)} · Max DD ${pct(m.max_drawdown)}`,
    `IC ${m.ic_mean.toFixed(4)} · IC-IR ${m.ic_ir.toFixed(2)} · Hit rate ${pct(m.hit_rate, 0)} · Turnover ${pct(m.avg_daily_turnover, 0)}`,
    `${m.n_trading_days.toLocaleString()} trading days`,
  ].join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
