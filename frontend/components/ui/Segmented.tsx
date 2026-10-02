"use client";

import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string | number> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  size?: "sm" | "md";
  className?: string;
}

/** Equal-width segmented control with a sliding pill. */
export function Segmented<T extends string | number>({ value, onChange, options, size = "md", className }: SegmentedProps<T>) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const n = options.length;
  return (
    <div
      role="tablist"
      className={cn(
        "relative grid rounded-[10px] border border-white/[0.07] bg-white/[0.03] p-[3px]",
        size === "sm" ? "h-8" : "h-9",
        className
      )}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      <div
        className="absolute top-[3px] bottom-[3px] left-[3px] rounded-[7px] bg-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ width: `calc((100% - 6px) / ${n})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-10 rounded-[7px] text-xs font-medium transition-colors",
            o.value === value ? "text-white" : "text-gray-500 hover:text-gray-300"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
