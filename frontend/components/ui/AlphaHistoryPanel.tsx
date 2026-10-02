"use client";

import { useEffect, useState } from "react";
import { X, Clock, Trash2, CornerDownRight, Brain, FlaskConical } from "lucide-react";
import { Expr } from "./Expr";
import { loadHistory, clearHistory } from "@/lib/alphaHistory";
import type { HistoryEntry } from "@/lib/alphaHistory";

interface AlphaHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  onLoad: (expression: string) => void;
}

const fmt2 = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toFixed(2));

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="eyebrow !text-[9px]">{label}</div>
      <div className={`mt-0.5 font-mono text-[13px] font-semibold tnum ${tone ?? "text-gray-200"}`}>{value}</div>
    </div>
  );
}

function HistoryCard({ entry, onLoad }: { entry: HistoryEntry; onLoad: () => void }) {
  const fitness = entry.wq?.fitness ?? null;
  return (
    <button
      onClick={onLoad}
      className="group w-full space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-left transition-all hover:border-lava-500/35 hover:bg-white/[0.045]"
    >
      <div className="flex items-start justify-between gap-3">
        <Expr code={entry.expression} className="break-all text-xs leading-relaxed" />
        <span className="flex flex-shrink-0 items-center gap-1 text-[10px] font-medium text-lava-400 opacity-0 transition-opacity group-hover:opacity-100">
          Load <CornerDownRight className="h-3 w-3" />
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
        {entry.local && (
          <>
            <Stat label="Sharpe" value={fmt2(entry.local.sharpe)} tone={entry.local.sharpe >= 1 ? "text-up" : undefined} />
            <Stat label="IC" value={entry.local.ic_mean.toFixed(4)} />
            <Stat label="IC-IR" value={fmt2(entry.local.ic_ir)} />
          </>
        )}
        {entry.wq && (
          <>
            {fitness !== null && <Stat label="BRAIN fitness" value={fitness.toFixed(2)} tone={fitness >= 1 ? "text-up" : fitness >= 0.5 ? "text-amber-400" : "text-down"} />}
            {entry.wq.sharpe !== null && <Stat label="BRAIN Sharpe" value={fmt2(entry.wq.sharpe)} />}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {entry.local && (
          <span className="flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-500">
            <FlaskConical className="h-2.5 w-2.5" /> Local
          </span>
        )}
        {entry.wq && (
          <span className="flex items-center gap-1 rounded-md border border-lava-500/30 bg-lava-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-lava-300">
            <Brain className="h-2.5 w-2.5" /> BRAIN · {entry.wq.universe}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-gray-600">{fmtDate(entry.timestamp)}</span>
      </div>
    </button>
  );
}

export function AlphaHistoryPanel({ open, onClose, onLoad }: AlphaHistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (open) setEntries(loadHistory());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] animate-fade-in bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="animate-slide-in-right fixed right-0 top-0 z-[70] flex h-full w-[420px] max-w-[94vw] flex-col border-l border-white/10 bg-[#0b0b0e]/95 shadow-[-30px_0_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-lava-400" />
            <span className="text-sm font-semibold text-gray-100">Alpha history</span>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-gray-500">{entries.length}</span>
          </div>
          <div className="flex items-center gap-3">
            {entries.length > 0 && (
              <button
                onClick={() => {
                  clearHistory();
                  setEntries([]);
                }}
                className="flex items-center gap-1 text-xs text-gray-600 transition-colors hover:text-down"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            )}
            <button onClick={onClose} aria-label="Close history" className="text-gray-500 transition-colors hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
          {entries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                <Clock className="h-5 w-5 text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-300">No runs yet</p>
              <p className="text-xs leading-relaxed text-gray-600">Run a backtest or submit to BRAIN and each expression lands here with its scores, stored only in this browser.</p>
            </div>
          ) : (
            entries.map((entry, i) => (
              <div key={entry.id} className="reveal" style={{ ["--i" as string]: Math.min(i, 8) * 0.5 }}>
                <HistoryCard entry={entry} onLoad={() => onLoad(entry.expression)} />
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
