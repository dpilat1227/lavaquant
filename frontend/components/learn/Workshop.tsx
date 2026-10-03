"use client";

import { useMemo, useState } from "react";
import { Play, CornerDownRight } from "lucide-react";
import { Expr } from "@/components/ui/Expr";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/switch";
import { ExplainSteps } from "./ExplainSteps";
import { explain } from "@/lib/explain";
import { emit, toast } from "@/lib/bus";

interface Idea {
  id: string;
  title: string;
  blurb: string;
  /** Does this idea have a look-back window? */
  window?: { label: string; def: number; options: number[] };
  /** Default direction: true = bet against the measure */
  against: boolean;
  build: (n: number) => string;
}

const IDEAS: Idea[] = [
  {
    id: "reversal",
    title: "Losers bounce back",
    blurb: "Stocks that fell recently tend to rebound, and recent winners give some back.",
    window: { label: "Look back how many days?", def: 5, options: [3, 5, 10, 21] },
    against: true,
    build: (n) => `ts_delta(close, ${n})`,
  },
  {
    id: "momentum",
    title: "Winners keep winning",
    blurb: "Stocks that rose steadily over months tend to keep rising.",
    window: { label: "Look back how many days?", def: 63, options: [21, 63, 126, 252] },
    against: false,
    build: (n) => `ts_delta(close, ${n}) / ts_delay(close, ${n})`,
  },
  {
    id: "calm",
    title: "Calm beats jumpy",
    blurb: "Steady stocks have historically earned as much as wild ones with less risk.",
    window: { label: "Measure over how many days?", def: 60, options: [10, 20, 60, 120] },
    against: true,
    build: (n) => `ts_std(returns, ${n})`,
  },
  {
    id: "crowded",
    title: "Crowded moves fade",
    blurb: "When price and volume rise together, the move is crowded and tends to reverse.",
    window: { label: "Measure over how many days?", def: 10, options: [5, 10, 20] },
    against: true,
    build: (n) => `ts_corr(close, volume, ${n})`,
  },
  {
    id: "attention",
    title: "Attention pays",
    blurb: "Stocks suddenly trading far above their usual volume are getting noticed.",
    window: { label: "Compare to the past how many days?", def: 60, options: [20, 60, 120] },
    against: false,
    build: (n) => `ts_mean(volume, 5) / ts_mean(volume, ${n})`,
  },
  {
    id: "high",
    title: "Near the high",
    blurb: "Stocks close to their highest price in a long while tend to keep climbing.",
    window: { label: "Highest price of the past how many days?", def: 252, options: [63, 126, 252] },
    against: false,
    build: (n) => `close / ts_max(close, ${n})`,
  },
  {
    id: "gap",
    title: "Overnight gaps fade",
    blurb: "A stock that jumps at the open tends to drift back during the day.",
    against: true,
    build: () => "gap",
  },
  {
    id: "close",
    title: "Where the day closed",
    blurb: "A close near the day's low often marks selling exhaustion and a bounce.",
    against: true,
    build: () => "(close - low) / (high - low)",
  },
];

/** True when the whole string is a single name or one function call, so it needs no extra parentheses. */
function isAtomic(s: string): boolean {
  if (/^\w+$/.test(s)) return true;
  if (!/^\w+\(/.test(s) || !s.endsWith(")")) return false;
  let depth = 0;
  for (let i = s.indexOf("("); i < s.length; i++) {
    if (s[i] === "(") depth++;
    if (s[i] === ")") depth--;
    if (depth === 0 && i < s.length - 1) return false;
  }
  return true;
}

export function Workshop({ onClose }: { onClose: () => void }) {
  const [ideaId, setIdeaId] = useState("reversal");
  const idea = IDEAS.find((i) => i.id === ideaId)!;
  const [windows, setWindows] = useState<Record<string, number>>({});
  const [against, setAgainst] = useState<Record<string, boolean>>({});
  const [rank, setRank] = useState(true);
  const [neutral, setNeutral] = useState(false);
  const [smooth, setSmooth] = useState(0);

  const n = windows[idea.id] ?? idea.window?.def ?? 0;
  const flip = against[idea.id] ?? idea.against;

  const expression = useMemo(() => {
    let e = idea.build(n);
    if (flip) e = isAtomic(e) ? `-${e}` : `-(${e})`;
    if (smooth > 0) e = `ts_decay_linear(${e}, ${smooth})`;
    if (rank) e = `rank(${e})`;
    if (neutral) e = `group_neutralize(${rank ? e : `rank(${e})`}, sector)`;
    return e;
  }, [idea, n, flip, smooth, rank, neutral]);

  const exp = useMemo(() => explain(expression), [expression]);

  function use(run: boolean) {
    emit("load-expression", expression);
    if (run) window.setTimeout(() => emit("run"), 250);
    else toast("Loaded into the editor");
    onClose();
  }

  return (
    <div className="space-y-7">
      <section className="space-y-2.5">
        <div className="eyebrow">1 · Pick an idea</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {IDEAS.map((i) => (
            <button
              key={i.id}
              onClick={() => setIdeaId(i.id)}
              data-active={i.id === ideaId}
              className="chip rounded-xl px-3.5 py-3 text-left"
            >
              <div className="text-[13px] font-semibold">{i.title}</div>
              <div className="mt-0.5 text-[11.5px] font-normal leading-snug text-gray-400">{i.blurb}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="eyebrow">2 · Tune it</div>

        {idea.window && (
          <div>
            <div className="mb-1.5 text-[12.5px] text-gray-400">{idea.window.label}</div>
            <Segmented
              size="sm"
              value={n}
              onChange={(v) => setWindows((w) => ({ ...w, [idea.id]: v }))}
              options={idea.window.options.map((o) => ({ value: o, label: `${o}d` }))}
            />
          </div>
        )}

        <div>
          <div className="mb-1.5 text-[12.5px] text-gray-400">Which way do you bet?</div>
          <Segmented
            size="sm"
            value={flip ? "against" : "with"}
            onChange={(v) => setAgainst((a) => ({ ...a, [idea.id]: v === "against" }))}
            options={[
              { value: "with", label: "With it (buy high scores)" },
              { value: "against", label: "Against it (flip the sign)" },
            ]}
          />
          <p className="mt-1.5 text-[11.5px] text-gray-600">The idea above has a natural direction. Flipping it is how you test the opposite belief, but pick the direction before you look at results.</p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="eyebrow">3 · Clean it up</div>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
          <div>
            <div className="text-[13px] font-medium text-gray-200">Rank across stocks</div>
            <div className="text-[11.5px] text-gray-500">Puts the score on a fixed -1 to +1 scale. Matters when you blend signals later.</div>
          </div>
          <Switch checked={rank} onCheckedChange={setRank} />
        </label>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
          <div>
            <div className="text-[13px] font-medium text-gray-200">Remove the sector effect</div>
            <div className="text-[11.5px] text-gray-500">Stops the alpha betting on whole sectors, leaving pure stock picking.</div>
          </div>
          <Switch checked={neutral} onCheckedChange={setNeutral} />
        </label>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[13px] font-medium text-gray-200">Smooth it to trade less</div>
              <div className="text-[11.5px] text-gray-500">Averages the signal over recent days, weighting the latest most.</div>
            </div>
            <Switch checked={smooth > 0} onCheckedChange={(c) => setSmooth(c ? 5 : 0)} />
          </div>
          {smooth > 0 && (
            <div className="mt-3">
              <Segmented size="sm" value={smooth} onChange={setSmooth} options={[3, 5, 10].map((o) => ({ value: o, label: `${o}d` }))} />
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="eyebrow">4 · Your alpha</div>
        <div className="overflow-x-auto rounded-xl border border-lava-500/25 bg-black/40 px-4 py-3.5 text-[14px] shadow-[inset_0_0_30px_-10px_rgba(255,106,61,0.25)]">
          <Expr code={expression} className="whitespace-nowrap" />
        </div>
        {exp.ok && <ExplainSteps exp={exp} source={expression} />}
        <div className="flex gap-2.5 pt-1">
          <button
            onClick={() => use(true)}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-lava-solid text-[13px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5 fill-current" /> Run it
          </button>
          <button
            onClick={() => use(false)}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 text-[13px] font-medium text-gray-300 transition-colors hover:bg-white/[0.09] hover:text-white"
          >
            Edit in the editor <CornerDownRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[12px] leading-relaxed text-gray-500">
          Then change <span className="text-gray-300">one</span> control, run again, and compare the two in History. That&apos;s how you learn what each piece does.
        </p>
      </section>
    </div>
  );
}
