"use client";

import { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot, ReferenceArea } from "recharts";
import { ChartTip } from "./ChartTip";
import { clean, drawdownSeries, longDate, yearLabel, yearTicks } from "@/lib/derive";
import type { TimeSeriesPoint } from "@/lib/types";

interface EquityChartProps {
  data: TimeSeriesPoint[];
  /** Shade everything from this date on as out-of-sample */
  holdoutFrom?: string;
}

const AXIS = { fill: "#8d8d97", fontSize: 10.5 };
const MARGIN = { top: 8, right: 12, left: 0, bottom: 0 };
const Y_WIDTH = 48;

interface Row {
  date: string;
  nav: number;
  ret: number;
  dd: number;
}

const pct = (v: number, d = 1) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`;

/** Equity curve with a synced underwater (drawdown) chart beneath it. */
export function EquityChart({ data, holdoutFrom }: EquityChartProps) {
  const rows = useMemo<Row[]>(() => {
    const eq = clean(data);
    const dd = drawdownSeries(eq);
    const base = eq[0]?.value ?? 100;
    return eq.map((p, i) => ({ date: p.date, nav: p.value, ret: p.value / base - 1, dd: dd[i].value }));
  }, [data]);

  const ticks = useMemo(() => yearTicks(rows), [rows]);
  const holdoutStart = useMemo(() => (holdoutFrom ? rows.find((r) => r.date >= holdoutFrom)?.date : undefined), [rows, holdoutFrom]);
  const trough = useMemo(() => rows.reduce((a, r) => (r.dd < a.dd ? r : a), rows[0]), [rows]);
  if (!rows.length) return null;

  const base = rows[0].nav;
  const ddFloor = Math.min(-0.02, Math.floor(trough.dd * 20) / 20);

  return (
    <div className="chart-glow">
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={rows} syncId="perf" margin={MARGIN}>
          <defs>
            <linearGradient id="eqStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffb36b" />
              <stop offset="55%" stopColor="#ff6a3d" />
              <stop offset="100%" stopColor="#ff3d81" />
            </linearGradient>
            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6a3d" stopOpacity={0.32} />
              <stop offset="70%" stopColor="#ff6a3d" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#ff6a3d" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" ticks={ticks} hide />
          <YAxis
            width={Y_WIDTH}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            domain={["auto", "auto"]}
            tickCount={5}
            tickFormatter={(v: number) => (Math.abs(v) >= 50 ? v.toFixed(0) : v.toFixed(2))}
          />
          {holdoutStart && (
            <ReferenceArea
              x1={holdoutStart}
              x2={rows[rows.length - 1].date}
              fill="rgba(255,255,255,0.05)"
              stroke="rgba(255,255,255,0.14)"
              strokeDasharray="3 3"
              label={{ value: "HOLDOUT · NOT USED FOR SELECTION", position: "insideTopLeft", fill: "#a1a1aa", fontSize: 9.5, letterSpacing: 1 }}
            />
          )}
          <ReferenceLine y={base} stroke="rgba(255,255,255,0.18)" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.28)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as Row;
              return (
                <ChartTip
                  title={longDate(r.date)}
                  rows={[
                    { label: "NAV", value: r.nav.toFixed(2), tone: "lava" },
                    { label: "Cumulative", value: pct(r.ret), tone: r.ret >= 0 ? "up" : "down" },
                    { label: "Drawdown", value: pct(r.dd), tone: r.dd < -0.0005 ? "down" : "muted" },
                  ]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="nav"
            stroke="url(#eqStroke)"
            strokeWidth={2.25}
            fill="url(#eqFill)"
            dot={false}
            activeDot={{ r: 4.5, fill: "#fff", stroke: "#ff6a3d", strokeWidth: 2.5 }}
            animationDuration={1600}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-1 flex items-center gap-2 pl-[52px]">
        <span className="eyebrow">Drawdown</span>
        <span className="font-mono text-[10.5px] text-gray-600">
          trough <span className="text-down">{pct(trough.dd)}</span> · {longDate(trough.date)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={96}>
        <AreaChart data={rows} syncId="perf" margin={{ ...MARGIN, top: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff5470" stopOpacity={0.02} />
              <stop offset="100%" stopColor="#ff5470" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={yearLabel}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            interval={0}
            tickMargin={6}
          />
          <YAxis
            width={Y_WIDTH}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            domain={[ddFloor, 0]}
            ticks={[ddFloor, 0]}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
          />
          <Tooltip cursor={{ stroke: "rgba(255,255,255,0.28)", strokeDasharray: "3 3" }} content={() => null} />
          <Area type="monotone" dataKey="dd" stroke="#ff5470" strokeWidth={1.25} fill="url(#ddFill)" dot={false} isAnimationActive={false} />
          <ReferenceDot x={trough.date} y={trough.dd} r={4} fill="#ff5470" stroke="#0d0d10" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
