"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ChartTip } from "./ChartTip";
import type { FeatureImportance } from "@/lib/types";

interface FeatureImportanceChartProps {
  data: FeatureImportance[];
}

export function FeatureImportanceChart({ data }: FeatureImportanceChartProps) {
  const sorted = [...data].sort((a, b) => b.importance - a.importance).slice(0, 15);

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 28)}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
        <XAxis type="number" tick={{ fill: "#8d8d97", fontSize: 10.5 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toFixed(2)} />
        <YAxis
          type="category"
          dataKey="feature"
          tick={{ fill: "#a1a1aa", fontSize: 11, fontFamily: "var(--font-geist-mono), monospace" }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload as FeatureImportance;
            return <ChartTip title={r.feature} rows={[{ label: "Importance", value: r.importance.toFixed(4), tone: "lava" }]} />;
          }}
        />
        <Bar dataKey="importance" fill="#ff8545" radius={[0, 6, 6, 0]} barSize={14} animationDuration={1000} />
      </BarChart>
    </ResponsiveContainer>
  );
}
