"use client";

import { useEffect } from "react";
import { GraduationCap, X } from "lucide-react";
import { StartHere } from "./StartHere";
import { Workshop } from "./Workshop";
import { CheatSheet } from "./CheatSheet";
import { Recipes } from "./Recipes";
import { MyAlpha } from "./MyAlpha";

export type LearnTab = "start" | "mine" | "workshop" | "cheatsheet" | "recipes";

const TABS: { id: LearnTab; label: string }[] = [
  { id: "start", label: "Start here" },
  { id: "mine", label: "Your alpha" },
  { id: "workshop", label: "Build one" },
  { id: "cheatsheet", label: "Cheat sheet" },
  { id: "recipes", label: "Known alphas" },
];

export function LearnPanel({ open, tab, onTab, onClose }: { open: boolean; tab: LearnTab; onTab: (t: LearnTab) => void; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="animate-slide-in-right fixed right-0 top-0 z-[70] flex h-full w-[540px] max-w-[94vw] flex-col border-l border-white/10 bg-[#0b0b0e]/95 shadow-[-30px_0_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div className="flex items-center gap-2.5">
            <GraduationCap className="h-4 w-4 text-lava-400" />
            <span className="text-sm font-semibold text-gray-100">Learn to build alphas</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 transition-colors hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto border-b border-white/[0.07] px-5 pb-3">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => onTab(t.id)} data-active={tab === t.id} className="chip flex-shrink-0 rounded-full px-3 py-1 text-[12px] font-medium">
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "start" && <StartHere go={onTab} />}
          <div className={tab === "mine" ? "" : "hidden"}>
            <MyAlpha />
          </div>
          {tab === "workshop" && <Workshop onClose={onClose} />}
          {tab === "cheatsheet" && <CheatSheet />}
          {tab === "recipes" && <Recipes onClose={onClose} />}
        </div>
      </div>
    </>
  );
}
