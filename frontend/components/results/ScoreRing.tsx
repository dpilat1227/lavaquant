"use client";

import { useEffect, useState } from "react";
import { useCountUp } from "@/lib/useCountUp";
import type { Score } from "@/lib/score";

/** Minimal score ring: a solid arc over a quiet track, animated on mount. */
export function ScoreRing({ score }: { score: Score }) {
  const [armed, setArmed] = useState(false);
  const shown = useCountUp(score.score, 1500);

  useEffect(() => {
    setArmed(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setArmed(true)));
    return () => cancelAnimationFrame(id);
  }, [score.score]);

  const R = 84;
  const C = 2 * Math.PI * R;
  const frac = score.score / 100;

  return (
    <div className="relative mx-auto h-[196px] w-[196px] select-none">
      <svg viewBox="0 0 196 196" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle cx="98" cy="98" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
        <circle
          cx="98"
          cy="98"
          r={R}
          fill="none"
          stroke={score.color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={armed ? C * (1 - frac) : C}
          transform="rotate(-90 98 98)"
          style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline gap-0.5">
          <span className="text-[48px] font-semibold leading-none tracking-tight tnum text-white">{Math.round(shown)}</span>
          <span className="text-xs text-gray-500">/100</span>
        </div>
        <span className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: score.color }}>
          {score.tier}
        </span>
      </div>
    </div>
  );
}
