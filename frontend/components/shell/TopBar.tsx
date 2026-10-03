"use client";

import { useEffect, useState } from "react";
import { BookOpen, Clock, GraduationCap, Search, Info, Trophy } from "lucide-react";
import { LogoMark } from "@/components/ui/LogoMark";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchHealth } from "@/lib/api";
import { emit } from "@/lib/bus";

function GitHubMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-label={label}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TopBar() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [mod, setMod] = useState("⌘");

  useEffect(() => {
    if (!/Mac|iPhone|iPad/i.test(navigator.platform)) setMod("Ctrl");
    let alive = true;
    const check = () => fetchHealth().then((ok) => alive && setOnline(ok));
    check();
    const id = window.setInterval(check, 30000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <header className="relative z-30 flex h-14 flex-shrink-0 items-center gap-4 border-b border-white/[0.07] bg-black/30 px-5 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <LogoMark size={28} />
        <div className="flex items-baseline gap-2.5">
          <span className="text-[15px] font-semibold tracking-tight text-white">LavaQuant</span>
          <span className="hidden h-3.5 w-px bg-white/15 lg:block" />
          <span className="hidden text-xs text-gray-500 lg:block">alpha research lab</span>
        </div>
      </div>

      <div className="flex flex-1 justify-center">
        <button
          onClick={() => emit("open-palette")}
          className="group flex h-9 w-full max-w-[440px] items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-left text-[13px] text-gray-500 transition-all hover:border-white/15 hover:bg-white/[0.06] hover:text-gray-300"
        >
          <Search className="h-3.5 w-3.5 text-gray-600 transition-colors group-hover:text-lava-400" />
          <span className="flex-1 truncate">Search operators, examples, actions…</span>
          <span className="flex items-center gap-1">
            <kbd className="kbd">{mod}</kbd>
            <kbd className="kbd">K</kbd>
          </span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="mr-2 hidden cursor-default items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[11px] text-gray-500 md:flex">
              <span
                className={`h-1.5 w-1.5 rounded-full ${online === null ? "bg-gray-600" : online ? "bg-up shadow-[0_0_8px_#3ddc97]" : "bg-down shadow-[0_0_8px_#ff5470]"} ${online ? "animate-breathe" : ""}`}
              />
              {online === null ? "Connecting" : online ? "Engine online" : "Engine offline"}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {online === false
              ? "The backtest API isn't reachable. The sample result still works; start the backend to run new backtests."
              : online
                ? "FastAPI backtest engine is responding."
                : "Checking the backtest engine…"}
          </TooltipContent>
        </Tooltip>
        <IconButton label="Learn to build alphas" onClick={() => emit("open-learn")}>
          <GraduationCap className="h-4 w-4" />
        </IconButton>
        <IconButton label="Alpha gallery" onClick={() => emit("open-gallery")}>
          <Trophy className="h-4 w-4" />
        </IconButton>
        <IconButton label="Alpha history" onClick={() => emit("open-history")}>
          <Clock className="h-4 w-4" />
        </IconButton>
        <IconButton label="Docs and glossary" onClick={() => emit("open-docs")}>
          <BookOpen className="h-4 w-4" />
        </IconButton>
        <IconButton label="About this project" onClick={() => emit("open-about")}>
          <Info className="h-4 w-4" />
        </IconButton>
        <a
          href="https://github.com/dpilat1227/lavaquant"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Source on GitHub"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <GitHubMark className="h-4 w-4" />
        </a>
        <a
          href="https://drew.fun"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1.5 hidden h-8 items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 text-[12px] font-medium text-gray-400 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white lg:flex"
        >
          drew.fun <span className="text-gray-600">↗</span>
        </a>
      </div>
    </header>
  );
}
