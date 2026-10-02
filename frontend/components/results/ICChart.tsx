"use client";

import { useMemo } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip } from "recharts";
import { ChartTip } from "./ChartTip";
import { clean, icBars, longDate, yearLabel, yearTicks, type IcBar } from "@/lib/derive";
import type { TimeSeriesPoint } from "@/lib/types";

interface ICChartProps {
  data: TimeSeriesPoint[];
  window?: number;
}

const AXIS = { fill: "#6b6b75", fontSize: 10.5 };

/** Daily IC as diverging bars, with a rolling-mean line and the overall mean as a reference. */
export function ICChart({ data, window = 60 }: ICChartProps) {
  const { rows, ticks, lim, mean } = useMemo(() => {
    const pts = clean(data);
    const rows = icBars(pts, window);
    const maxAbs = pts.reduce((a, p) => Math.max(a, Math.abs(p.value)), 0.02);
    const lim = Math.ceil(maxAbs / 0.04) * 0.04;
    const mean = pts.length ? pts.reduce((a, p) => a + p.value, 0) / pts.length : 0;
    return { rows, ticks: yearTicks(rows), lim, mean };
  }, [data, window]);

  if (!rows.length) return null;

  return (
    <div className="chart-glow-soft">
      <ResponsiveContainer width="100%" height={230}>
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
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
          <ReferenceLine y={mean} stroke="#ff6a3d" strokeOpacity={0.55} strokeDasharray="4 4" />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as IcBar;
              return (
                <ChartTip
                  title={longDate(r.date)}
                  rows={[
                    { label: "IC", value: r.v.toFixed(4), tone: r.v >= 0 ? "up" : "down" },
                    { label: `${window}d average`, value: r.roll === null ? "—" : r.roll.toFixed(4), tone: "lava" },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="pos" fill="#3ddc97" fillOpacity={0.5} isAnimationActive={false} />
          <Bar dataKey="neg" fill="#ff5470" fillOpacity={0.5} isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="roll"
            stroke="#ffb36b"
            strokeWidth={2.25}
            dot={false}
            connectNulls
            activeDot={{ r: 4, fill: "#fff", stroke: "#ffb36b", strokeWidth: 2 }}
            animationDuration={1400}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 pl-[52px] text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2 w-2 rounded-sm bg-up/60" /> positive day
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2 w-2 rounded-sm bg-down/60" /> negative day
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-[3px] w-3 rounded bg-[#ffb36b]" /> {window}-day average
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-0 w-3 border-t border-dashed border-lava-500/70" /> overall mean{" "}
          <span className="font-mono text-gray-400">{mean.toFixed(4)}</span>
        </span>
      </div>
    </div>
  );
}
