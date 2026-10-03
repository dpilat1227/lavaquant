"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, GraduationCap } from "lucide-react";
import { ExplainSteps } from "@/components/learn/ExplainSteps";
import { explain } from "@/lib/explain";
import { emit } from "@/lib/bus";

const KEY = "lq_explain_open";

/** Live plain-English breakdown of whatever is in the editor. */
export function ExplainCard({ expression, forward }: { expression: string; forward: number }) {
  const [open, setOpen] = useState(true);
  const exp = useMemo(() => explain(expression), [expression]);

  useEffect(() => {
    if (localStorage.getItem(KEY) === "0") setOpen(false);
  }, []);

  function toggle() {
    setOpen((o) => {
      localStorage.setItem(KEY, o ? "0" : "1");
      return !o;
    });
  }

  const empty = !expression.trim();

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <button onClick={toggle} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-gray-500 transition-transform duration-300 ${open ? "" : "-rotate-90"}`} />
          <span className="eyebrow">What this does</span>
          {exp.ok && <span className="rounded-full bg-white/[0.07] px-2 py-0.5 font-mono text-[10px] text-gray-400">{exp.steps.length} step{exp.steps.length === 1 ? "" : "s"}</span>}
        </button>
        <button
          onClick={() => emit("open-learn", { tab: "start" })}
          className="flex flex-shrink-0 items-center gap-1.5 text-[11px] font-medium text-lava-400 transition-colors hover:text-lava-300"
        >
          <GraduationCap className="h-3.5 w-3.5" /> Learn
        </button>
      </div>

      {open && (
        <div className="animate-fade-in border-t border-white/[0.06] px-3.5 pb-4 pt-3.5">
          {empty ? (
            <p className="text-[12.5px] leading-relaxed text-gray-500">Write an expression, or pick an example, and I&apos;ll explain it one step at a time.</p>
          ) : exp.ok ? (
            <ExplainSteps exp={exp} source={expression} forward={forward} />
          ) : (
            <p className="text-[12.5px] leading-relaxed text-gray-400">
              <span className="text-gray-500">Can&apos;t explain this yet:</span> {exp.error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
