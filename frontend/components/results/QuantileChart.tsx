"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine, LabelList } from "recharts";
import { ChartTip } from "./ChartTip";
import type { QuantileReturn } from "@/lib/types";

interface QuantileChartProps {
  data: QuantileReturn[];
}

// Q1 (short) → Q5 (long): rose → amber → mint
const STOPS: [number, number, number][] = [
  [255, 84, 112],
  [255, 200, 87],
  [61, 220, 151],
];

function colorAt(i: number, n: number): string {
  const t = n <= 1 ? 0.5 : i / (n - 1);
  const seg = t * (STOPS.length - 1);
  const a = Math.min(Math.floor(seg), STOPS.length - 2);
  const f = seg - a;
  const c = STOPS[a].map((v, k) => Math.round(v + (STOPS[a + 1][k] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function QuantileChart({ data }: QuantileChartProps) {
  const rows = data.map((d) => ({ ...d, label: /^\d+$/.test(d.quantile) ? `Q${d.quantile}` : d.quantile.split(" ")[0] }));
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={rows} margin={{ top: 22, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} tickMargin={8} />
        <YAxis hide domain={["auto", "auto"]} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload as QuantileReturn;
            const v = r.mean_return;
            return (
              <ChartTip
                title={r.quantile}
                rows={[{ label: "Mean forward return", value: `${v >= 0 ? "+" : ""}${(v * 100).toFixed(3)}%`, tone: v >= 0 ? "up" : "down" }]}
              />
            );
          }}
        />
        <Bar dataKey="mean_return" radius={[6, 6, 6, 6]} maxBarSize={52} animationDuration={1100}>
          {rows.map((_, i) => (
            <Cell key={i} fill={colorAt(i, rows.length)} fillOpacity={0.9} />
          ))}
          <LabelList
            dataKey="mean_return"
            position="top"
            formatter={(v: unknown) => `${Number(v) >= 0 ? "+" : ""}${(Number(v) * 100).toFixed(2)}%`}
            style={{ fill: "#a1a1aa", fontSize: 10.5, fontFamily: "var(--font-geist-mono), monospace" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
