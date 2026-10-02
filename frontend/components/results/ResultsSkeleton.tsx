"use client";

import { Panel } from "@/components/ui/Panel";

function Block({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

export function ResultsSkeleton({ label = "Running backtest" }: { label?: string }) {
  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <div className="relative h-[3px] w-40 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-lava-solid animate-indeterminate" />
        </div>
        <span className="eyebrow animate-breathe">{label}…</span>
      </div>

      <Panel spotlight={false} className="overflow-hidden">
        <div className="hero-grid items-center px-6 py-6">
          <div className="space-y-4">
            <Block className="h-5 w-48" />
            <Block className="h-9 w-4/5" />
            <Block className="h-11 w-full" />
            <div className="flex gap-2">
              <Block className="h-6 w-20 !rounded-full" />
              <Block className="h-6 w-24 !rounded-full" />
              <Block className="h-6 w-16 !rounded-full" />
            </div>
          </div>
          <div className="mx-auto h-[196px] w-[196px] rounded-full shimmer opacity-60" style={{ WebkitMask: "radial-gradient(circle, transparent 62%, #000 63%)", mask: "radial-gradient(circle, transparent 62%, #000 63%)" }} />
        </div>
        <div className="hairline-grid border-t border-white/[0.07]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 bg-[#0d0d10] px-5 py-4">
              <Block className="h-3 w-16" />
              <Block className="h-8 w-24" />
              <Block className="h-1 w-full" />
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid-2-1">
        <Panel spotlight={false} className="p-5">
          <Block className="mb-4 h-3 w-24" />
          <Block className="h-[330px] w-full" />
        </Panel>
        <Panel spotlight={false} className="space-y-5 p-5">
          <Block className="h-3 w-24" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Block className="h-3 w-3/4" />
              <Block className="h-1.5 w-full" />
            </div>
          ))}
        </Panel>
      </div>
      <div className="grid-2-1">
        <Panel spotlight={false} className="p-5">
          <Block className="mb-4 h-3 w-24" />
          <Block className="h-[230px] w-full" />
        </Panel>
        <Panel spotlight={false} className="p-5">
          <Block className="mb-4 h-3 w-24" />
          <Block className="h-[210px] w-full" />
        </Panel>
      </div>
    </div>
  );
}
