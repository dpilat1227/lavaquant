"use client";

import { Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sticks to the bottom of the workbench scroll area so the primary action is always reachable. */
export function StickyFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none sticky bottom-0 -mx-5 mt-6 bg-gradient-to-t from-[#08080a] via-[#08080a]/95 to-transparent px-5 pb-5 pt-8">
      <div className="pointer-events-auto flex gap-2.5">{children}</div>
    </div>
  );
}

export function RunButton({
  loading,
  disabled,
  label,
  loadingLabel,
  hint,
  onClick,
}: {
  loading: boolean;
  disabled?: boolean;
  label: string;
  loadingLabel: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={cn(
        "group relative flex h-11 flex-1 items-center justify-center gap-2.5 overflow-hidden rounded-xl text-sm font-semibold text-white transition-all duration-200",
        "bg-lava-gradient shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_30px_-8px_rgba(255,106,61,0.65)]",
        "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_14px_40px_-8px_rgba(255,106,61,0.85)] hover:brightness-110 active:scale-[0.985]",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:brightness-100"
      )}
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          <Play className="h-3.5 w-3.5 fill-current" />
          {label}
          {hint && <span className="ml-1 rounded-md bg-black/20 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white/80">{hint}</span>}
        </>
      )}
    </button>
  );
}
