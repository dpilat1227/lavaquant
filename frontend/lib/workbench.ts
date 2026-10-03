"use client";

import { useSyncExternalStore } from "react";
import type { BacktestMetrics } from "./types";

/** What the editor currently holds, shared with the Learn drawer so it can explain and coach the live alpha. */
export interface WorkbenchState {
  expression: string;
  forward: number;
  /** Metrics from the latest run, only when it was for the expression currently in the editor */
  metrics: BacktestMetrics | null;
}

let state: WorkbenchState = { expression: "", forward: 5, metrics: null };
const listeners = new Set<() => void>();

export function setWorkbench(next: WorkbenchState) {
  if (next.expression === state.expression && next.forward === state.forward && next.metrics === state.metrics) return;
  state = next;
  listeners.forEach((l) => l());
}

export function useWorkbench(): WorkbenchState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state
  );
}
