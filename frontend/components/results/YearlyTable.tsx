"use client";

import { useMemo } from "react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { InfoTip } from "@/components/ui/InfoTip";
import { yearlyStats } from "@/lib/yearly";
import type { BacktestResponse } from "@/lib/types";

const sign = (v: number, good = 0) => (v > good ? "text-up" : v < good ? "text-down" : "text-gray-200");

/** Year-by-year results, laid out like BRAIN's IS summary so the two can be compared directly. */
export function YearlyTable({ result }: { result: BacktestResponse }) {
  const rows = useMemo(() => yearlyStats(result), [result]);
  if (rows.length === 0) return null;

  return (
    <Panel>
      <PanelHeader
        title="By year"
        hint="The same columns as WorldQuant's IS summary. Look for years that disagree: one great year can hide four bad ones."
        right={<InfoTip text="Sharpe, return and drawdown are computed within each year. Turnover is the average share of the portfolio traded per day. Fitness is the local estimate: Sharpe × √(|return| / max(turnover, 12.5%)). A partial first or last year is annualized." focus="Fitness" />}
      />
      <div className="overflow-x-auto px-5 pb-4">
        <table className="w-full min-w-[520px] text-right font-mono text-[12px] tnum">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
              {["Year", "Sharpe", "Turnover", "Fitness", "Return", "Drawdown", "IC mean"].map((h, i) => (
                <th key={h} className={`pb-2 font-medium ${i === 0 ? "text-left" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={`border-t border-white/[0.06] ${r.label === "All" ? "bg-white/[0.03] font-semibold" : ""}`}>
                <td className="py-2 text-left text-gray-300">
                  {r.label}
                  {r.label !== "All" && r.days < 200 && <span className="ml-1.5 text-[10px] font-normal text-gray-600">{r.days}d</span>}
                </td>
                <td className={`py-2 ${sign(r.sharpe)}`}>{r.sharpe.toFixed(2)}</td>
                <td className="py-2 text-gray-300">{(r.turnover * 100).toFixed(1)}%</td>
                <td className={`py-2 ${sign(r.fitness)}`}>{r.fitness.toFixed(2)}</td>
                <td className={`py-2 ${sign(r.ret)}`}>{(r.ret * 100).toFixed(1)}%</td>
                <td className="py-2 text-gray-300">{(r.drawdown * 100).toFixed(1)}%</td>
                <td className={`py-2 ${r.icMean === null ? "text-gray-600" : sign(r.icMean)}`}>{r.icMean === null ? "—" : r.icMean.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
