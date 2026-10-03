"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, CornerDownRight, Play, Search } from "lucide-react";
import { Expr } from "@/components/ui/Expr";
import { ExplainSteps } from "./ExplainSteps";
import { RECIPES, RECIPE_FAMILIES } from "@/lib/recipes";
import type { Recipe, RecipeFamily } from "@/lib/recipes";
import { explain } from "@/lib/explain";
import { emit, toast } from "@/lib/bus";

interface Stat {
  sharpe: number;
  ic_mean: number;
  ic_ir: number;
  annual_return: number;
  max_drawdown: number;
  avg_daily_turnover: number;
}
interface StatsFile {
  universe: string;
  period: string;
  stats: Record<string, Stat>;
}

const LEVELS = ["", "Starter", "Intermediate", "Advanced"];

function Num({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="eyebrow !text-[9px]">{label}</div>
      <div className={`mt-0.5 font-mono text-[13px] font-semibold tnum ${tone ?? "text-gray-200"}`}>{value}</div>
    </div>
  );
}

function RecipeCard({ r, stat, onClose }: { r: Recipe; stat?: Stat; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const exp = useMemo(() => (open ? explain(r.expression) : null), [open, r.expression]);

  function use(run: boolean) {
    emit("load-expression", r.expression);
    if (run) window.setTimeout(() => emit("run"), 250);
    else toast("Loaded into the editor");
    onClose();
  }

  const worked = stat ? stat.sharpe >= 0.4 : false;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-gray-100">{r.name}</div>
          {r.source && <div className="mt-0.5 text-[11px] text-gray-600">{r.source}</div>}
        </div>
        <span className="flex-shrink-0 rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-gray-400">{LEVELS[r.level]}</span>
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-gray-400">{r.idea}</p>

      <div className="mt-2.5 overflow-x-auto whitespace-nowrap rounded-lg bg-black/30 px-3 py-2 text-[12.5px]">
        <Expr code={r.expression} />
      </div>

      {stat && (
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
          <Num label="Sharpe" value={stat.sharpe.toFixed(2)} tone={stat.sharpe >= 0.4 ? "text-up" : stat.sharpe < 0 ? "text-down" : undefined} />
          <Num label="IC-IR" value={stat.ic_ir.toFixed(3)} tone={stat.ic_ir < 0 ? "text-down" : undefined} />
          <Num label="Return / yr" value={`${(stat.annual_return * 100).toFixed(1)}%`} tone={stat.annual_return < 0 ? "text-down" : undefined} />
          <Num label="Turnover / day" value={`${(stat.avg_daily_turnover * 100).toFixed(0)}%`} />
          {!worked && <span className="pb-0.5 text-[11px] text-amber-300/80">{stat.sharpe < 0 ? "Lost money on this sample" : "Weak on this sample"}</span>}
        </div>
      )}

      {r.tweaks.length > 0 && (
        <ul className="mt-3 space-y-1">
          {r.tweaks.map((t) => (
            <li key={t} className="flex gap-2 text-[12px] leading-snug text-gray-500">
              <span className="text-gray-700">›</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => setOpen((o) => !o)} className="mt-3 flex items-center gap-1 text-[12px] font-medium text-gray-400 hover:text-white">
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide the breakdown" : "How does it work?"}
      </button>
      {exp?.ok && (
        <div className="mt-3">
          <ExplainSteps exp={exp} source={r.expression} />
        </div>
      )}

      <div className="mt-3.5 flex gap-2">
        <button
          onClick={() => use(true)}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-lava-solid px-3.5 text-[12px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <Play className="h-3 w-3 fill-current" /> Run it
        </button>
        <button
          onClick={() => use(false)}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 text-[12px] font-medium text-gray-300 transition-colors hover:bg-white/[0.09] hover:text-white"
        >
          Edit it <CornerDownRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function Recipes({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<StatsFile | null>(null);
  const [family, setFamily] = useState<RecipeFamily | "All">("All");
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/learn/recipe-stats.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const query = q.trim().toLowerCase();
  const list = RECIPES.filter((r) => (family === "All" || r.family === family) && (!query || `${r.name} ${r.idea} ${r.expression} ${r.source ?? ""}`.toLowerCase().includes(query)));

  return (
    <div className="space-y-5">
      <p className="text-[12.5px] leading-relaxed text-gray-500">
        Well-known ideas, written in this language. Each one explains itself, and you can run it or take it apart.
        {data && (
          <>
            {" "}
            Numbers below are backtests on a {data.universe}, {data.period}, before trading costs. Many classic alphas do <span className="text-gray-300">not</span> work on this sample. That&apos;s normal, and it&apos;s worth seeing.
          </>
        )}
      </p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-600" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, idea or operator…" className="field !pl-9" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["All", ...RECIPE_FAMILIES] as const).map((f) => (
          <button key={f} onClick={() => setFamily(f)} data-active={family === f} className="chip rounded-full px-3 py-1 text-[11.5px] font-medium">
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {list.map((r) => (
          <RecipeCard key={r.id} r={r} stat={data?.stats[r.id]} onClose={onClose} />
        ))}
        {list.length === 0 && <p className="py-8 text-center text-sm text-gray-500">Nothing matches.</p>}
      </div>
    </div>
  );
}
