"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CornerDownRight, Loader2, Trophy, X } from "lucide-react";
import { Expr } from "@/components/ui/Expr";
import { InfoTip } from "@/components/ui/InfoTip";
import { emit, toast } from "@/lib/bus";
import { loadGalleryIndex, loadGalleryResult } from "@/lib/gallery";
import type { GalleryAlpha, GalleryIndex } from "@/lib/gallery";

function Spark({ values, split }: { values: number[]; split: number }) {
  const w = 120;
  const h = 34;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pt = (v: number, i: number) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`;
  const cut = Math.max(1, Math.min(values.length - 1, Math.round(split * (values.length - 1))));
  const a = values.slice(0, cut + 1).map(pt).join(" ");
  const b = values.slice(cut).map((v, i) => pt(v, i + cut)).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[34px] w-[120px]" aria-hidden>
      <rect x={(cut / (values.length - 1)) * w} y="0" width={w - (cut / (values.length - 1)) * w} height={h} fill="rgba(255,255,255,0.05)" />
      <polyline points={a} fill="none" stroke="#8d8d97" strokeWidth="1.5" strokeLinejoin="round" />
      <polyline points={b} fill="none" stroke="#ff8545" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="eyebrow !text-[9px]">{label}</div>
      <div className={`mt-0.5 font-mono text-[15px] font-semibold tnum ${tone ?? "text-gray-100"}`}>{value}</div>
    </div>
  );
}

function Card({ alpha, index, busy, onView, onEdit }: { alpha: GalleryAlpha; index: GalleryIndex; busy: boolean; onView: () => void; onEdit: () => void }) {
  const held = alpha.holdout.sharpe >= 0.4;
  return (
    <div className="space-y-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-white">{alpha.name}</h3>
            <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-500">{alpha.family}</span>
          </div>
          <span
            className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              held ? "border-up/30 bg-up/10 text-up" : "border-amber-400/30 bg-amber-400/10 text-amber-300"
            }`}
          >
            {held ? "Held up out of sample" : "Didn't hold up"}
          </span>
          <p className="mt-1 text-[12.5px] leading-relaxed text-gray-400">{alpha.idea}</p>
        </div>
        <Spark values={alpha.spark} split={alpha.sparkSplit} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2 text-[12px]">
        <Expr code={alpha.expression} className="whitespace-nowrap" />
      </div>

      <div className="flex items-end gap-6">
        <Stat label={`Sharpe · ${index.selectedOn}`} value={alpha.picked.sharpe.toFixed(2)} />
        <ArrowRight className="mb-1 h-3.5 w-3.5 text-gray-600" />
        <Stat label={`Sharpe · ${index.holdoutLabel}`} value={alpha.holdout.sharpe.toFixed(2)} tone={held ? "text-up" : alpha.holdout.sharpe > 0 ? "text-amber-400" : "text-down"} />
        <Stat label="IC-IR holdout" value={alpha.holdout.ic_ir.toFixed(2)} />
      </div>

      {!held && (
        <p className="rounded-lg border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2 text-[11.5px] leading-relaxed text-amber-200/80">
          Looked strong on the period it was picked from, then faded to roughly zero on data it hadn&apos;t seen. A textbook case of overfitting, kept here as a cautionary example.
        </p>
      )}

      <div className="flex gap-2 pt-0.5">
        <button
          onClick={onView}
          disabled={busy}
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-lava-solid text-[13px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          View saved result
        </button>
        <button
          onClick={onEdit}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3.5 text-[13px] font-medium text-gray-300 transition-colors hover:bg-white/[0.09] hover:text-white"
        >
          Edit <CornerDownRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function GalleryPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState<GalleryIndex | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || index) return;
    loadGalleryIndex()
      .then(setIndex)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the gallery"));
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function view(alpha: GalleryAlpha) {
    if (!index) return;
    setBusyId(alpha.id);
    try {
      const result = await loadGalleryResult(alpha.id);
      emit("show-result", {
        result,
        meta: { source: "saved", holdoutFrom: index.holdoutFrom, note: `${alpha.name} · ${index.universe} · ${index.fullPeriod}` },
      });
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't load that result", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] animate-fade-in bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="animate-slide-in-right fixed right-0 top-0 z-[70] flex h-full w-[480px] max-w-[94vw] flex-col border-l border-white/10 bg-[#0b0b0e]/95 shadow-[-30px_0_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-4 w-4 text-lava-400" />
            <span className="text-sm font-semibold text-gray-100">Alpha gallery</span>
          </div>
          <button onClick={onClose} aria-label="Close gallery" className="text-gray-500 transition-colors hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {error && <p className="rounded-xl border border-down/25 bg-down/10 px-3.5 py-2.5 text-xs text-red-200">{error}</p>}
          {!index && !error && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="shimmer h-44 rounded-xl" />
              ))}
            </div>
          )}
          {index && (
            <>
              <div className="rounded-xl border border-lava-500/20 bg-lava-500/[0.05] px-4 py-3 text-[12.5px] leading-relaxed text-gray-300">
                Picked from <span className="font-semibold text-white">{index.candidatesTested}</span> textbook ideas using <span className="font-semibold text-white">{index.selectedOn}</span> only.
                The right-hand numbers come from <span className="font-semibold text-white">{index.holdoutLabel}</span>, which the selection never saw.
                <span className="ml-1 inline-flex align-middle">
                  <InfoTip text="Picking the best of many tries inflates results, because some will look good by luck. Holding back a later period shows how much of the edge survives on data the pick never touched." />
                </span>
              </div>
              {index.alphas.map((a) => (
                <Card key={a.id} alpha={a} index={index} busy={busyId === a.id} onView={() => void view(a)} onEdit={() => { emit("load-expression", a.expression); onClose(); }} />
              ))}
              <p className="px-1 pb-2 pt-1 text-[11px] leading-relaxed text-gray-600">
                Real backtests on a {index.universe} sample, gross of costs, run {index.generatedAt}. Past results don&apos;t predict future returns.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
