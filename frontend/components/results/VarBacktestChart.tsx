"use client";

import { useMemo } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, Scatter, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip } from "recharts";
import { ChartTip } from "./ChartTip";
import { longDate, yearLabel, yearTicks } from "@/lib/derive";
import type { RiskSeriesPoint } from "@/lib/types";

interface VarBacktestChartProps {
  series: RiskSeriesPoint[];
  /** 0.95 or 0.99: which rolling VaR line to draw */
  confidence: number;
}

interface Row {
  date: string;
  pnl: number;
  pos: number | null;
  neg: number | null;
  /** −VaR for the day, drawn as the floor a day should not fall through */
  floor: number | null;
  /** The day's loss when it fell through the floor, else null */
  breach: number | null;
}

const AXIS = { fill: "#8d8d97", fontSize: 10.5 };
const pct = (v: number, d = 2) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(d)}%`;

/** Year ticks, minus a first one that would sit on top of the next (the series starts a few days before New Year). */
function axisTicks(rows: { date: string }[]): string[] {
  const ticks = yearTicks(rows);
  const gapDays = ticks.length > 1 ? (Date.parse(ticks[1]) - Date.parse(ticks[0])) / 86_400_000 : Infinity;
  return gapDays < 120 ? ticks.slice(1) : ticks;
}

/** Daily P&L against the rolling VaR line, with the days that broke through it marked. */
export function VarBacktestChart({ series, confidence }: VarBacktestChartProps) {
  const key = confidence >= 0.99 ? "var99" : "var95";

  const { rows, ticks, lim, breaches } = useMemo(() => {
    const rows: Row[] = series.map((p) => {
      const v = p[key];
      const floor = v === undefined || v === null ? null : -v;
      return {
        date: p.date,
        pnl: p.pnl,
        pos: p.pnl >= 0 ? p.pnl : null,
        neg: p.pnl < 0 ? p.pnl : null,
        floor,
        breach: floor !== null && p.pnl < floor ? p.pnl : null,
      };
    });
    const maxAbs = rows.reduce((a, r) => Math.max(a, Math.abs(r.pnl), Math.abs(r.floor ?? 0)), 0.01);
    const step = maxAbs > 0.05 ? 0.02 : 0.01;
    return {
      rows,
      ticks: axisTicks(rows),
      lim: Math.ceil(maxAbs / step) * step,
      breaches: rows.filter((r) => r.breach !== null).length,
    };
  }, [series, key]);

  if (!rows.length) return null;

  return (
    <div className="chart-glow-soft">
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap={0} barGap={0}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" ticks={ticks} tickFormatter={yearLabel} tick={AXIS} axisLine={false} tickLine={false} interval={0} tickMargin={6} />
          <YAxis
            width={48}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            domain={[-lim, lim]}
            ticks={[-lim, -lim / 2, 0, lim / 2, lim]}
            tickFormatter={(v: number) => `${(v * 100).toFixed(lim < 0.05 ? 1 : 0)}%`}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as Row;
              return (
                <ChartTip
                  title={longDate(r.date)}
                  rows={[
                    { label: "Day's return", value: pct(r.pnl), tone: r.pnl >= 0 ? "up" : "down" },
                    { label: `${Math.round(confidence * 100)}% VaR`, value: r.floor === null ? "—" : pct(r.floor), tone: "lava" },
                    ...(r.breach !== null ? [{ label: "Result", value: "Breach", tone: "down" as const }] : []),
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="pos" fill="#3ddc97" fillOpacity={0.32} isAnimationActive={false} />
          <Bar dataKey="neg" fill="#ff5470" fillOpacity={0.32} isAnimationActive={false} />
          <Line type="stepAfter" dataKey="floor" stroke="#ff8a4d" strokeWidth={1.75} dot={false} connectNulls isAnimationActive={false} activeDot={false} />
          <Scatter
            dataKey="breach"
            isAnimationActive={false}
            shape={(p: { cx?: number; cy?: number; payload?: Row }) =>
              p.cx === undefined || p.cy === undefined || p.payload?.breach == null ? (
                <g />
              ) : (
                <circle cx={p.cx} cy={p.cy} r={3.2} fill="#ff3d81" stroke="#fff" strokeWidth={0.9} />
              )
            }
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 pl-[52px] text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2 w-2 rounded-sm bg-white/30" /> daily return
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-[3px] w-3 rounded bg-[#ff8a4d]" /> {Math.round(confidence * 100)}% VaR, rolling
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2 w-2 rounded-full bg-[#ff3d81]" /> breach <span className="font-mono text-gray-400">{breaches}</span>
        </span>
      </div>
    </div>
  );
}
