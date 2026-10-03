"use client";

import { useEffect, useRef } from "react";

/** Where the result on screen came from, so the UI can label it honestly. */
export interface ResultMeta {
  source: "sample" | "live" | "saved";
  /** First date of the out-of-sample period, shaded on the equity chart */
  holdoutFrom?: string;
  /** Human-readable context for saved results, e.g. "US equities · 2020–2024" */
  note?: string;
}

/** Minimal typed event bus so the command palette, top bar and workbench can talk without prop drilling. */
export interface BusEvents {
  run: undefined;
  "submit-brain": undefined;
  "load-expression": string;
  "insert-text": string;
  "open-docs": { tab?: string; focus?: string; query?: string } | undefined;
  "open-history": undefined;
  "open-gallery": undefined;
  "show-result": { result: import("./types").BacktestResponse; meta: ResultMeta };
  "open-palette": undefined;
  "open-about": undefined;
  "set-mode": "expression" | "ml";
  "copy-link": undefined;
  "copy-summary": undefined;
  toast: { message: string; tone?: "ok" | "error" };
}

type Name = keyof BusEvents;

export function emit<K extends Name>(name: K, ...detail: undefined extends BusEvents[K] ? [BusEvents[K]?] : [BusEvents[K]]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`lq:${name}`, { detail: detail[0] }));
}

export function toast(message: string, tone: "ok" | "error" = "ok") {
  emit("toast", { message, tone });
}

export function useBus<K extends Name>(name: K, handler: (detail: BusEvents[K]) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = (e: Event) => ref.current((e as CustomEvent).detail);
    window.addEventListener(`lq:${name}`, fn);
    return () => window.removeEventListener(`lq:${name}`, fn);
  }, [name]);
}
