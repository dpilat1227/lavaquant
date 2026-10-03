"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Brain, FlaskConical, Layers, LineChart, Zap } from "lucide-react";
import { LogoMark } from "./LogoMark";
import { DSL_FIELDS, DSL_FUNCTIONS } from "@/lib/dsl";
import { useModKey } from "@/lib/useModKey";

const SEEN_KEY = "lavaquant_seen_landing";

export function useLandingModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
  }, []);

  return {
    open,
    show: () => setOpen(true),
    dismiss: () => {
      localStorage.setItem(SEEN_KEY, "1");
      setOpen(false);
    },
  };
}

interface LandingModalProps {
  open: boolean;
  onDismiss: () => void;
}

const FEATURES = [
  { icon: Zap, title: "Expression editor", desc: "WorldQuant-style DSL with live syntax checks, hover docs and autocomplete." },
  { icon: Layers, title: "Local backtest engine", desc: "Vectorized rank-IC, IC-IR and Sharpe across equities, ETFs, FX and commodities." },
  { icon: Brain, title: "BRAIN integration", desc: "Send the same expression to WorldQuant BRAIN and compare official scores." },
  { icon: FlaskConical, title: "Purged ML pipeline", desc: "LightGBM with purged, embargoed time-series cross-validation (López de Prado)." },
];

const STACK = ["Python", "FastAPI", "Next.js", "TypeScript", "LightGBM", "Recharts"];

// Decorative equity-style curve, deterministic
const SPARK = (() => {
  const pts: string[] = [];
  const n = 80;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * 640;
    const y = 156 - i * 1.08 + Math.sin(i * 0.55) * 5.5 + Math.sin(i * 1.7) * 2.4 + (i > 38 && i < 52 ? (i - 38) * 0.6 * (i < 45 ? 1 : (52 - i) / 7 * 1) : 0);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
})();

export function LandingModal({ open, onDismiss }: LandingModalProps) {
  const mod = useModKey();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-[#050506]/80 backdrop-blur-md" onClick={onDismiss} />

      <div className="panel reveal relative w-full max-w-[640px] overflow-hidden !rounded-3xl shadow-[0_60px_160px_-20px_rgba(0,0,0,0.95),0_0_120px_-30px_rgba(255,106,61,0.35)]">
        {/* header art */}
        <div className="relative h-[172px] overflow-hidden border-b border-white/[0.07]">
          <div className="absolute inset-0 bg-[radial-gradient(500px_220px_at_70%_0%,rgba(255,106,61,0.28),transparent_70%),radial-gradient(400px_200px_at_10%_100%,rgba(255,61,129,0.18),transparent_70%)]" />
          <svg viewBox="0 0 640 172" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="sparkStroke" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#ffb36b" stopOpacity="0.1" />
                <stop offset="60%" stopColor="#ff6a3d" />
                <stop offset="100%" stopColor="#ff3d81" />
              </linearGradient>
              <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ff6a3d" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#ff6a3d" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${SPARK} L640 172 L0 172 Z`} fill="url(#sparkFill)" className="animate-fade-in" style={{ animationDelay: "1.2s" }} />
            <path
              d={SPARK}
              fill="none"
              stroke="url(#sparkStroke)"
              strokeWidth="2.5"
              strokeLinecap="round"
              pathLength={1}
              style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: "draw 2.4s cubic-bezier(0.16,1,0.3,1) 0.2s forwards", filter: "drop-shadow(0 0 8px rgba(255,106,61,0.7))" }}
            />
          </svg>
          <div className="absolute left-7 top-6 flex items-center gap-4">
            <LogoMark size={52} />
            <div>
              <h1 className="text-[30px] font-semibold leading-none tracking-tight text-white">LavaQuant</h1>
              <p className="mt-1.5 text-[13px] text-gray-400">Quantitative alpha research platform</p>
            </div>
          </div>
        </div>

        <div className="px-7 pb-7 pt-6">
          <p className="max-w-[520px] text-[15px] leading-relaxed text-gray-300">
            Write cross-sectional alphas, backtest them in seconds, and see how they stack up against <span className="text-white">WorldQuant BRAIN</span> and{" "}
            <span className="text-white">Numerai</span> standards.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="reveal flex gap-3" style={{ ["--i" as string]: i + 2 }}>
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.09] bg-white/[0.04]">
                  <f.icon className="h-4 w-4 text-lava-400" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold leading-tight text-gray-100">{f.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-3 divide-x divide-white/[0.07] rounded-xl border border-white/[0.07] bg-white/[0.02]">
            {[
              [String(DSL_FUNCTIONS.length), "operators"],
              [String(DSL_FIELDS.length), "data fields"],
              ["4", "asset universes"],
            ].map(([n, l]) => (
              <div key={l} className="px-4 py-3 text-center">
                <div className="text-xl font-semibold tnum text-white">{n}</div>
                <div className="eyebrow !text-[9.5px]">{l}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-100">Drew Pilat</p>
              <p className="mt-0.5 text-xs text-gray-500">MS Computer Science · University of Chicago</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {STACK.map((s) => (
                  <span key={s} className="rounded-md border border-white/[0.09] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-gray-500">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="group relative mt-7 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-lava-solid text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_40px_-10px_rgba(255,106,61,0.7)] transition-all hover:brightness-110 active:scale-[0.99]"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <LineChart className="h-4 w-4" />
            Explore the sample alpha
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <p className="mt-3 text-center text-[11px] text-gray-600">
            Press <kbd className="kbd">{mod}</kbd> <kbd className="kbd">K</kbd> any time for commands
          </p>
        </div>
      </div>
    </div>
  );
}
