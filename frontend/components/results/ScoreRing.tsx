"use client";

import { useEffect, useState } from "react";
import { useCountUp } from "@/lib/useCountUp";
import type { Score } from "@/lib/score";

const TICKS = 60;

/** Dial-style score gauge with tick marks and an animated sweep. */
export function ScoreRing({ score }: { score: Score }) {
  const [armed, setArmed] = useState(false);
  const shown = useCountUp(score.score, 1500);

  useEffect(() => {
    setArmed(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setArmed(true)));
    return () => cancelAnimationFrame(id);
  }, [score.score]);

  const R = 68;
  const C = 2 * Math.PI * R;
  const frac = score.score / 100;

  return (
    <div className="relative mx-auto h-[196px] w-[196px] select-none">
      <svg viewBox="0 0 196 196" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={score.color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={score.color} />
          </linearGradient>
        </defs>

        {Array.from({ length: TICKS }, (_, i) => {
          const a = (i / TICKS) * 360;
          const active = armed && i / TICKS < frac;
          return (
            <line
              key={i}
              x1="98"
              y1="6"
              x2="98"
              y2={i % 5 === 0 ? "15" : "11"}
              transform={`rotate(${a} 98 98)`}
              stroke={active ? score.color : "rgba(255,255,255,0.12)"}
              strokeOpacity={active ? 0.9 : 1}
              strokeWidth={i % 5 === 0 ? 1.6 : 1}
              strokeLinecap="round"
              style={{ transition: `stroke 0.4s ease ${(i / TICKS) * 1.3}s` }}
            />
          );
        })}

        <circle cx="98" cy="98" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
        <circle
          cx="98"
          cy="98"
          r={R}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={armed ? C * (1 - frac) : C}
          transform="rotate(-90 98 98)"
          style={{
            transition: "stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)",
            filter: `drop-shadow(0 0 8px ${score.color}88)`,
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline gap-0.5">
          <span className="text-[46px] font-semibold leading-none tracking-tight tnum text-white">{Math.round(shown)}</span>
          <span className="text-xs text-gray-600">/100</span>
        </div>
        <span
          className="mt-2 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: score.color, borderColor: `${score.color}55`, background: `${score.color}14` }}
        >
          {score.tier}
        </span>
      </div>
    </div>
  );
}
