"use client";

import { Fragment } from "react";
import { ArrowRight, Lightbulb } from "lucide-react";
import { Expr } from "@/components/ui/Expr";
import { KIND_LABEL, type Explanation, type StepKind } from "@/lib/explain";
import { emit } from "@/lib/bus";

const KIND_COLOR: Record<StepKind, string> = {
  time: "#ffb36b",
  cross: "#c4a7ff",
  group: "#5eead4",
  math: "#a1a1aa",
};

function Ref({ n }: { n: string }) {
  return (
    <span className="mx-0.5 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-white/[0.1] px-1 align-[1px] font-mono text-[10px] font-semibold text-gray-200">
      {n}
    </span>
  );
}

function Text({ text }: { text: string }) {
  const parts = text.split(/\[\[(\d+)\]\]/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <Ref key={i} n={p} /> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

/** Numbered, plain-English walkthrough of an expression. */
export function ExplainSteps({ exp, source, forward = 5 }: { exp: Explanation; source: string; forward?: number }) {
  if (!exp.ok) return null;
  return (
    <div className="space-y-4">
      {exp.uses.length > 0 && (
        <div>
          <div className="eyebrow !text-[9.5px]">Data it uses</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {exp.uses.map((u) => (
              <span key={u.name} className="inline-flex items-baseline gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11.5px] text-gray-500">
                <code className="font-mono text-[#5eead4]">{u.name}</code>
                {u.phrase.replace(/^the /, "")}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="eyebrow !text-[9.5px]">Step by step</div>
        <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
          One formula, built up in layers. Each step wraps the one before it, so the code grows until the last step is the whole thing.
        </p>
      </div>

      <ol className="space-y-4">
        {exp.steps.map((s) => (
          <li key={s.n} className="flex gap-3">
            <span className="mt-[1px] flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/15 font-mono text-[10.5px] font-semibold text-gray-300">
              {s.n}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 overflow-x-auto text-[12.5px] leading-snug">
                  <Expr code={s.code} className="whitespace-nowrap" />
                </div>
                <span className="flex flex-shrink-0 items-center gap-1.5 text-[10.5px] text-gray-500">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND_COLOR[s.kind] }} />
                  {KIND_LABEL[s.kind]}
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-400">
                <Text text={s.text} />
              </p>
            </div>
          </li>
        ))}
      </ol>

      {exp.finalStep > 0 && (
        <div className="flex gap-2.5 rounded-xl border border-lava-500/20 bg-lava-500/[0.05] px-3.5 py-3 text-[12.5px] leading-relaxed text-gray-300">
          <ArrowRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-lava-400" />
          <span>
            Step <Ref n={String(exp.finalStep)} /> is your alpha: one score per stock per day. The engine buys the top 20%, shorts the bottom 20%, and checks whether those picks beat the rest over the next {forward} days.
          </span>
        </div>
      )}

      {exp.tunables.length > 0 && (
        <div className="space-y-2">
          <div className="eyebrow !text-[9.5px]">Try changing</div>
          {exp.tunables.map((t, i) => (
            <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] text-gray-500">
              <span>
                The <code className="font-mono text-lava-300">{t.value}</code> in <code className="font-mono text-gray-300">{t.where}</code> is {t.label}. Try
              </span>
              {t.options.map((o) => (
                <button
                  key={o}
                  onClick={() => emit("load-expression", source.slice(0, t.start) + o + source.slice(t.end))}
                  className="chip rounded-md px-2 py-0.5 font-mono text-[11px]"
                >
                  {o}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {exp.tips.map((t, i) => (
        <div key={i} className="flex gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 text-[12px] leading-relaxed text-gray-400">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
          <span>{t}</span>
        </div>
      ))}
    </div>
  );
}
