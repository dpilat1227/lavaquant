"use client";

import { ExternalLink, X, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Expr } from "@/components/ui/Expr";
import type { WQSimResult } from "@/lib/types";

interface WQResultsProps {
  result: WQSimResult;
  expression: string;
  onClear: () => void;
}

function Cell({
  label,
  value,
  format = "decimal",
  good,
  threshold,
}: {
  label: string;
  value: number | null;
  format?: "decimal" | "percent" | "count";
  good?: boolean | null;
  threshold?: string;
}) {
  const display =
    value === null ? "—" : format === "percent" ? `${(value * 100).toFixed(1)}%` : format === "count" ? String(Math.round(value)) : value.toFixed(3);
  const color = good === true ? "text-up" : good === false ? "text-down" : "text-gray-100";
  return (
    <div>
      <div className="eyebrow !text-[9.5px]">{label}</div>
      <div className={`mt-1 font-mono text-base font-semibold tnum ${color}`}>{display}</div>
      {threshold && <div className="text-[10px] text-gray-600">{threshold}</div>}
    </div>
  );
}

function FitnessBar({ fitness }: { fitness: number | null }) {
  if (fitness === null) return null;
  const pct = (Math.max(0, Math.min(fitness, 2)) / 2) * 100;
  const color = fitness >= 1 ? "#3ddc97" : fitness >= 0.5 ? "#ffc857" : "#ff5470";
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="eyebrow !text-[9.5px]">BRAIN Fitness</span>
        <span className="font-mono text-xs font-semibold" style={{ color }}>
          {fitness.toFixed(2)} <span className="font-sans font-normal text-gray-500">{fitness >= 1 ? "clears the bar" : "below 1.0"}</span>
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        <div className="absolute -top-[3px] h-[12px] w-px bg-white/50" style={{ left: "50%" }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-gray-600">
        <span>0</span>
        <span>1.0 minimum</span>
        <span>2.0</span>
      </div>
    </div>
  );
}

export function WQResults({ result, expression, onClear }: WQResultsProps) {
  const m = result.metrics;
  return (
    <div className="animate-pop-in relative overflow-hidden rounded-xl border border-lava-500/25 bg-lava-500/[0.05] p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lava-500/60 to-transparent" />
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          {result.status === "done" ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-up" />
          ) : result.status === "pending" ? (
            <Clock className="h-4 w-4 flex-shrink-0 text-amber-400" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-down" />
          )}
          <div>
            <div className="text-sm font-semibold text-gray-100">WorldQuant BRAIN</div>
            {result.settings && (
              <div className="font-mono text-[10px] text-gray-500">
                {result.settings.universe} · {result.settings.neutralization} · D{result.settings.delay}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {result.alpha_id && (
            <a
              href={`https://platform.worldquantbrain.com/alpha/${result.alpha_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-lava-300 transition-colors hover:text-lava-200"
            >
              Open in BRAIN <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button onClick={onClear} aria-label="Dismiss BRAIN result" className="text-gray-600 transition-colors hover:text-gray-300">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {result.status === "pending" && (
        <p className="text-xs leading-relaxed text-amber-300">The simulation is still running on WorldQuant&apos;s servers. Check your BRAIN dashboard for the result.</p>
      )}

      {result.status === "done" && m && (
        <>
          <div className="grid grid-cols-3 gap-x-4 gap-y-4">
            <Cell label="Sharpe (IS)" value={m.sharpe} good={m.sharpe !== null ? m.sharpe > 1 : null} threshold="> 1.0" />
            <Cell label="Returns (IS)" value={m.returns} format="percent" good={m.returns !== null ? m.returns > 0 : null} />
            <Cell label="Drawdown (IS)" value={m.drawdown} format="percent" good={m.drawdown !== null ? m.drawdown > -0.1 : null} />
            <Cell label="Turnover" value={m.turnover} format="percent" good={m.turnover !== null ? m.turnover < 0.7 : null} threshold="< 70%" />
            <Cell label="Long" value={m.long_count} format="count" />
            <Cell label="Short" value={m.short_count} format="count" />
          </div>

          {(m.os_fitness !== null || m.os_sharpe !== null) && (
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-4">
              <Cell label="Sharpe (OOS)" value={m.os_sharpe} good={m.os_sharpe !== null ? m.os_sharpe > 0.5 : null} />
              <Cell label="Fitness (OOS)" value={m.os_fitness} good={m.os_fitness !== null ? m.os_fitness > 1 : null} threshold="> 1.0" />
            </div>
          )}

          <FitnessBar fitness={m.fitness} />

          <div className="mt-4 border-t border-white/[0.06] pt-3">
            <div className="eyebrow mb-1.5 !text-[9.5px]">Submitted</div>
            <Expr code={expression} className="break-all text-xs" />
          </div>
        </>
      )}
    </div>
  );
}
