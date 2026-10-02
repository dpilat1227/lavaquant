"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { emit } from "@/lib/bus";

/** An info glyph: hover for a short tip, click to open the full glossary entry in the docs. */
export function InfoTip({ text, focus, tab = "metrics" }: { text: string; focus?: string; tab?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={focus ? `About ${focus}` : "More info"}
          onClick={(e) => {
            e.stopPropagation();
            if (focus) emit("open-docs", { tab, focus });
          }}
          className="inline-flex text-gray-600 hover:text-lava-400 transition-colors cursor-help"
        >
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {text}
        {focus && <span className="mt-1 block text-[10px] text-lava-400/80">Click for the full definition</span>}
      </TooltipContent>
    </Tooltip>
  );
}
