"use client";

import { useMemo } from "react";
import { Expr } from "@/components/ui/Expr";
import { ExplainSteps } from "./ExplainSteps";
import { CoachCard } from "./CoachCard";
import { explain } from "@/lib/explain";
import { useWorkbench } from "@/lib/workbench";

/** Live explanation and coaching for whatever is in the editor right now. */
export function MyAlpha() {
  const { expression, forward, metrics } = useWorkbench();
  const exp = useMemo(() => explain(expression), [expression]);
  const empty = !expression.trim();

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="eyebrow">What this does</div>
        <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3 text-[14px]">
          {empty ? <span className="text-gray-600">The editor is empty</span> : <Expr code={expression} className="whitespace-nowrap" />}
        </div>
        {empty ? (
          <p className="text-[12.5px] leading-relaxed text-gray-500">Write an expression, or pick an example, and it gets explained here one step at a time.</p>
        ) : exp.ok ? (
          <ExplainSteps exp={exp} source={expression} forward={forward} />
        ) : (
          <p className="text-[12.5px] leading-relaxed text-gray-400">
            <span className="text-gray-500">Can&apos;t explain this yet:</span> {exp.error}
          </p>
        )}
      </section>

      <div className="border-t border-white/[0.07] pt-6">
        <CoachCard expression={expression} forward={forward} metrics={metrics} />
      </div>
    </div>
  );
}
