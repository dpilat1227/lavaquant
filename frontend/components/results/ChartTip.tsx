interface Row {
  label: string;
  value: string;
  tone?: "up" | "down" | "lava" | "muted";
}

const TONE: Record<NonNullable<Row["tone"]>, string> = {
  up: "text-up",
  down: "text-down",
  lava: "text-lava-300",
  muted: "text-gray-200",
};

export function ChartTip({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="min-w-[150px] rounded-xl border border-white/10 bg-[#101013]/95 px-3 py-2.5 shadow-2xl backdrop-blur-md">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-gray-500">{title}</div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-6 text-xs">
            <span className="text-gray-500">{r.label}</span>
            <span className={`font-mono font-medium tnum ${TONE[r.tone ?? "muted"]}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
