"use client";

import { useMemo } from "react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { clean, monthlyReturns, MONTH_LABELS } from "@/lib/derive";
import type { TimeSeriesPoint } from "@/lib/types";

function cellStyle(r: number | null, maxAbs: number): React.CSSProperties {
  if (r === null) return { background: "rgba(255,255,255,0.02)" };
  const a = 0.1 + 0.62 * Math.min(1, Math.abs(r) / (maxAbs || 1));
  return { background: r >= 0 ? `rgba(61, 220, 151, ${a})` : `rgba(255, 84, 112, ${a})` };
}

const fmt = (r: number) => `${r >= 0 ? "+" : "−"}${Math.abs(r * 100).toFixed(1)}`;

export function MonthlyHeatmap({ equity }: { equity: TimeSeriesPoint[] }) {
  const t = useMemo(() => monthlyReturns(clean(equity)), [equity]);
  if (!t.rows.length) return null;

  return (
    <Panel>
      <PanelHeader
        title="Monthly returns"
        hint="Calendar view of long-short P&L. Look for streaks, not just the average."
        right={
          <div className="flex items-center gap-4 font-mono text-[11px] text-gray-500">
            {t.best && (
              <span>
                best <span className="text-up">{fmt(t.best.value)}%</span> <span className="text-gray-600">{t.best.label}</span>
              </span>
            )}
            {t.worst && (
              <span>
                worst <span className="text-down">{fmt(t.worst.value)}%</span> <span className="text-gray-600">{t.worst.label}</span>
              </span>
            )}
            <span>
              <span className="text-gray-300">{Math.round(t.positiveShare * 100)}%</span> positive
            </span>
          </div>
        }
      />
      <div className="overflow-x-auto px-5 pb-5">
        <table className="w-full min-w-[640px] border-separate font-mono text-[10.5px]" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th className="w-10" />
              {MONTH_LABELS.map((m) => (
                <th key={m} className="pb-1 text-center font-medium text-gray-600">
                  {m}
                </th>
              ))}
              <th className="pb-1 pl-2 text-center font-semibold text-gray-500">Year</th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((row, ri) => (
              <tr key={row.year}>
                <td className="pr-2 text-right font-medium text-gray-500">{row.year}</td>
                {row.months.map((r, i) => (
                  <td
                    key={i}
                    title={r === null ? "" : `${MONTH_LABELS[i]} ${row.year}: ${fmt(r)}%`}
                    className="reveal h-9 rounded-md text-center tnum transition-transform hover:scale-[1.08]"
                    style={{ ...cellStyle(r, t.maxAbs), ["--i" as string]: ri * 2 + (i % 4) * 0.3, color: r === null ? "transparent" : "rgba(255,255,255,0.88)" }}
                  >
                    {r === null ? "·" : fmt(r)}
                  </td>
                ))}
                <td className="pl-2 text-center">
                  <span className={`inline-block w-full rounded-md py-2.5 font-semibold tnum ${row.total >= 0 ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>
                    {fmt(row.total)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
