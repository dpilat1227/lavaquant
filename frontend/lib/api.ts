import type {
  Feature,
  OperatorsResponse,
  BacktestResponse,
  ExpressionBacktestRequest,
  MLBacktestRequest,
  WQSimRequest,
  WQSimResult,
} from "./types";

// Tolerate a missing scheme or trailing slash in NEXT_PUBLIC_API_URL
function normalizeBase(raw: string): string {
  const s = raw.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(s)) return s;
  return `${/^(localhost|127\.|0\.0\.0\.0)/.test(s) ? "http" : "https"}://${s}`;
}

const BASE_URL = normalizeBase(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

export async function fetchHealth(): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: ctrl.signal, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") {
        msg = body.detail;
      } else if (Array.isArray(body.detail)) {
        // FastAPI 422 validation errors
        msg = body.detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join("; ");
      } else if (typeof body.message === "string") {
        msg = body.message;
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export function fetchFeatures(): Promise<Feature[]> {
  return apiFetch<Feature[]>("/api/features");
}

export function fetchOperators(): Promise<OperatorsResponse> {
  return apiFetch<OperatorsResponse>("/api/dsl/operators");
}

export function runExpressionBacktest(
  body: ExpressionBacktestRequest
): Promise<BacktestResponse> {
  return apiFetch<BacktestResponse>("/api/backtest/expression", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function runMLBacktest(
  body: MLBacktestRequest
): Promise<BacktestResponse> {
  return apiFetch<BacktestResponse>("/api/backtest/ml", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function submitToWQBrain(body: WQSimRequest): Promise<WQSimResult> {
  return apiFetch<WQSimResult>("/api/wq/simulate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
