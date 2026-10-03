"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { ExplainSteps } from "./ExplainSteps";
import { Expr } from "@/components/ui/Expr";
import { explain } from "@/lib/explain";

const BLOCKS = [
  { color: "#5eead4", title: "Data", body: "The raw ingredients, one number per stock per day.", example: "close   volume   returns   high   low" },
  { color: "#ffb36b", title: "Over time, per stock", body: "Look back at one stock's own history. Every ts_ operator does this.", example: "ts_delta(close, 5)   ts_mean(returns, 20)" },
  { color: "#c4a7ff", title: "Across stocks, each day", body: "Compare stocks to each other on the same day.", example: "rank(x)   zscore(x)" },
  { color: "#5eead4", title: "Within a group", body: "Compare stocks only against others in their sector.", example: "group_neutralize(x, sector)" },
  { color: "#a1a1aa", title: "Math", body: "Combine and reshape numbers.", example: "+  -  *  /  **   abs(x)   log(x)" },
];

const STEPS = [
  ["Start with a sentence", "\"Stocks that fell a lot last week tend to bounce back.\" If you can't say it in a sentence, you can't test it."],
  ["Turn it into a number per stock", "\"Fell a lot last week\" becomes the 5-day change in price, flipped: -ts_delta(close, 5)."],
  ["Clean it up", "rank() so scores are comparable. group_neutralize(…, sector) to drop sector bets. ts_decay_linear(…, 5) to trade less."],
  ["Test it", "Run it. Read IC (does the score predict returns?), Sharpe (how smooth is the profit?), and turnover (how expensive to trade?)."],
  ["Change one thing, test again", "Never two at once, or you won't know what helped. Keep notes. Save the winners."],
];

export function StartHere({ go }: { go: (tab: "workshop" | "cheatsheet" | "recipes") => void }) {
  const exp = useMemo(() => explain("rank(-ts_delta(close, 5))"), []);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-[19px] font-semibold leading-tight tracking-tight text-white">An alpha is a score for every stock, every day.</h3>
        <p className="text-[13.5px] leading-relaxed text-gray-400">
          High score means buy it. Low score means short it. Your expression is the recipe for that score. Each day the engine takes the top 20% and the bottom 20% and checks whether your picks really did better than the rest. That check is what IC and Sharpe measure.
        </p>
      </section>

      <section className="space-y-3">
        <div className="eyebrow">Read your first alpha</div>
        <div className="rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3 text-[14px]">
          <Expr code="rank(-ts_delta(close, 5))" />
        </div>
        <p className="text-[12.5px] leading-relaxed text-gray-500">It reads from the inside out. Here it is in plain English:</p>
        <ExplainSteps exp={exp} source="rank(-ts_delta(close, 5))" />
        <p className="text-[12.5px] leading-relaxed text-gray-500">
          Anything you type in the editor gets this same treatment in the <span className="text-gray-300">What this does</span> card.
        </p>
      </section>

      <section className="space-y-3">
        <div className="eyebrow">The five kinds of building block</div>
        <div className="space-y-2">
          {BLOCKS.map((b) => (
            <div key={b.title} className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
              <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: b.color }} />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-gray-200">{b.title}</div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">{b.body}</p>
                <code className="mt-1.5 block overflow-x-auto whitespace-nowrap font-mono text-[11.5px] text-gray-400">{b.example}</code>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[12.5px] leading-relaxed text-gray-500">
          Windows are counted in trading days: <span className="font-mono text-gray-300">5</span> is about a week, <span className="font-mono text-gray-300">21</span> a month,{" "}
          <span className="font-mono text-gray-300">63</span> a quarter, <span className="font-mono text-gray-300">252</span> a year.
        </p>
      </section>

      <section className="space-y-3">
        <div className="eyebrow">How to build your own</div>
        <ol className="space-y-3">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-lava-500/15 font-mono text-[10.5px] font-semibold text-lava-300">{i + 1}</span>
              <div>
                <div className="text-[13px] font-semibold text-gray-200">{title}</div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-100/80">
          Be suspicious of any result that looks great. Test on one period, then check on a later one it never saw. The Alpha gallery shows what happens when you don&apos;t.
        </p>
      </section>

      <section className="grid gap-2.5 sm:grid-cols-3">
        {[
          ["Build one step by step", "workshop"],
          ["Look up an operator", "cheatsheet"],
          ["Browse known alphas", "recipes"],
        ].map(([label, tab]) => (
          <button
            key={tab}
            onClick={() => go(tab as "workshop" | "cheatsheet" | "recipes")}
            className="group flex items-center justify-between gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-3 text-left text-[12.5px] font-medium text-gray-200 transition-colors hover:border-lava-500/40 hover:bg-lava-500/10"
          >
            {label}
            <ArrowRight className="h-3.5 w-3.5 text-gray-500 transition-transform group-hover:translate-x-0.5 group-hover:text-lava-300" />
          </button>
        ))}
      </section>
    </div>
  );
}
