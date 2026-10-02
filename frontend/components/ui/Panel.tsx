"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Cursor-following ember border glow on hover */
  spotlight?: boolean;
  flat?: boolean;
}

export function Panel({ className, spotlight = true, flat = false, children, onMouseMove, ...rest }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        if (spotlight && ref.current) {
          const r = ref.current.getBoundingClientRect();
          ref.current.style.setProperty("--mx", `${e.clientX - r.left}px`);
          ref.current.style.setProperty("--my", `${e.clientY - r.top}px`);
        }
        onMouseMove?.(e);
      }}
      className={cn(flat ? "panel-flat" : "panel", spotlight && !flat && "spot", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  hint,
  right,
  className,
}: {
  title: string;
  hint?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h3 className="eyebrow">{title}</h3>
        {hint && <p className="mt-1 text-xs text-gray-500 leading-snug">{hint}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
