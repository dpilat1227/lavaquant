/**
 * Client-side alpha submission history backed by localStorage.
 */
import type { WQMetrics } from "./types";

export interface HistoryEntry {
  id: string;
  timestamp: number;
  expression: string;
  local?: {
    sharpe: number;
    ic_mean: number;
    ic_ir: number;
    annual_return: number;
  };
  wq?: {
    fitness: number | null;
    sharpe: number | null;
    universe: string;
    neutralization: string;
    delay: number;
  };
}

const KEY = "alphagen_history";
const MAX_ENTRIES = 100;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function addLocalResult(
  expression: string,
  metrics: { sharpe: number; ic_mean: number; ic_ir: number; annual_return: number }
): HistoryEntry {
  const existing = loadHistory();
  // Update existing entry for same expression if present
  const idx = existing.findIndex((e) => e.expression === expression);
  if (idx !== -1) {
    existing[idx].local = metrics;
    existing[idx].timestamp = Date.now();
    saveHistory(existing);
    return existing[idx];
  }
  const entry: HistoryEntry = {
    id: Math.random().toString(36).slice(2),
    timestamp: Date.now(),
    expression,
    local: metrics,
  };
  saveHistory([entry, ...existing]);
  return entry;
}

export function addWQResult(
  expression: string,
  wqMetrics: WQMetrics,
  settings: { universe: string; neutralization: string; delay: number }
) {
  const existing = loadHistory();
  const idx = existing.findIndex((e) => e.expression === expression);
  const wq = {
    fitness: wqMetrics.fitness,
    sharpe: wqMetrics.sharpe,
    ...settings,
  };
  if (idx !== -1) {
    existing[idx].wq = wq;
    saveHistory(existing);
  } else {
    saveHistory([{ id: Math.random().toString(36).slice(2), timestamp: Date.now(), expression, wq }, ...existing]);
  }
}

export function clearHistory() {
  localStorage.removeItem(KEY);
}
