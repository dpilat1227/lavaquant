"use client";

import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  tooltip?: string;
  positive?: boolean | null;
  zoneColor?: string;
  className?: string;
}

export function MetricCard({ label, value, tooltip, positive, zoneColor, className }: MetricCardProps) {
  const colorClass =
    positive === true
      ? "text-emerald-400"
      : positive === false
        ? "text-red-400"
        : "text-white";

  return (
    <div
      className={cn(
        "glass rounded-xl flex flex-col min-w-0 overflow-hidden",
        className
      )}
    >
      <div className="p-4 flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider truncate">
            {label}
          </span>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-gray-600 hover:text-gray-400 cursor-help flex-shrink-0" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <span className={cn("text-xl font-bold tabular-nums", colorClass)}>{value}</span>
      </div>
      {zoneColor && (
        <div className={cn("h-0.5 w-full flex-shrink-0", zoneColor)} />
      )}
    </div>
  );
}
