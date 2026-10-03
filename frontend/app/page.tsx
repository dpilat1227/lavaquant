"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StrategyBuilder } from "@/components/builder/StrategyBuilder";
import { ResultsPanel } from "@/components/results/ResultsPanel";
import { ResultsSkeleton } from "@/components/results/ResultsSkeleton";
import { LandingModal, useLandingModal } from "@/components/ui/LandingModal";
import { ReferencePanel } from "@/components/ui/ReferencePanel";
import { AlphaHistoryPanel } from "@/components/ui/AlphaHistoryPanel";
import { Toaster } from "@/components/ui/Toaster";
import { LogoMark } from "@/components/ui/LogoMark";
import { TopBar } from "@/components/shell/TopBar";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { FEATURED_ALPHA } from "@/lib/featuredAlpha";
import { emit, toast, useBus } from "@/lib/bus";
import type { ResultMeta } from "@/lib/bus";
import { GalleryPanel } from "@/components/shell/GalleryPanel";
import { LearnPanel } from "@/components/learn/LearnPanel";
import type { LearnTab } from "@/components/learn/LearnPanel";
import { buildAlphaLink, buildSummary, copyText } from "@/lib/share";
import type { BacktestResponse } from "@/lib/types";

const SIDEBAR_KEY = "lavaquant_sidebar_w";
const SIDEBAR_MIN = 380;
const SIDEBAR_MAX = 640;
const SIDEBAR_DEFAULT = 448;

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable || !!el.closest?.(".monaco-editor");
}

export default function Home() {
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [resultKey, setResultKey] = useState(0);
  const [meta, setMeta] = useState<ResultMeta>({ source: "sample" });
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [learn, setLearn] = useState<{ open: boolean; tab: LearnTab }>({ open: false, tab: "start" });
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Running backtest");
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [mod, setMod] = useState("⌘");

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [docs, setDocs] = useState<{ open: boolean; tab?: string; focus?: string; query?: string }>({ open: false });
  const [historyOpen, setHistoryOpen] = useState(false);
  const landing = useLandingModal();

  const [sidebarW, setSidebarW] = useState(SIDEBAR_DEFAULT);
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef(SIDEBAR_DEFAULT);

  useEffect(() => {
    setResult(FEATURED_ALPHA);
    if (!/Mac|iPhone|iPad/i.test(navigator.platform)) setMod("Ctrl");
    const saved = Number(localStorage.getItem(SIDEBAR_KEY));
    if (saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX) {
      setSidebarW(saved);
      widthRef.current = saved;
    }
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 960);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (meta && e.key === "Enter") {
        e.preventDefault();
        emit("run");
      } else if ((e.key === "?" || (meta && e.key === "/")) && !isTypingTarget(e.target)) {
        e.preventDefault();
        setDocs({ open: true });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useBus("open-palette", () => setPaletteOpen(true));
  useBus("open-docs", (d) => setDocs({ open: true, tab: d?.tab, focus: d?.focus, query: d?.query }));
  useBus("open-history", () => setHistoryOpen(true));
  useBus("open-gallery", () => setGalleryOpen(true));
  useBus("open-learn", (d) => setLearn((l) => ({ open: true, tab: d?.tab ?? l.tab })));
  useBus("show-result", (d) => {
    setResult(d.result);
    setMeta(d.meta);
    setResultKey((k) => k + 1);
    setError("");
  });
  useBus("open-about", () => landing.show());
  useBus("copy-link", async () => {
    const expr = result?.expression;
    if (!expr) return toast("Run or load an alpha first", "error");
    toast((await copyText(buildAlphaLink(expr))) ? "Link copied. Anyone can open this alpha in the editor." : "Couldn't access the clipboard", "ok");
  });
  useBus("copy-summary", async () => {
    if (!result) return toast("Nothing to copy yet", "error");
    toast((await copyText(buildSummary(result))) ? "Summary copied to clipboard" : "Couldn't access the clipboard");
  });

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  }
  function onDrag(e: React.PointerEvent) {
    if (!dragging) return;
    const w = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, e.clientX));
    widthRef.current = w;
    setSidebarW(w);
  }
  function endDrag() {
    if (!dragging) return;
    setDragging(false);
    localStorage.setItem(SIDEBAR_KEY, String(Math.round(widthRef.current)));
  }

  if (isMobile) return <MobileView />;

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={300}>
      <div className={`flex h-dvh flex-col overflow-hidden text-gray-100 ${dragging ? "select-none" : ""}`}>
        <TopBar />

        {error && (
          <div className="animate-pop-in mx-5 mt-3 flex items-start gap-3 rounded-xl border border-down/30 bg-down/10 px-4 py-3 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-down" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-red-100">The request didn&apos;t complete</p>
              <p className="mt-0.5 break-words text-[13px] text-red-200/80">{error}</p>
            </div>
            <button onClick={() => setError("")} aria-label="Dismiss" className="text-red-300/70 transition-colors hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <main className="flex min-h-0 flex-1">
          <aside style={{ width: sidebarW }} className="relative flex-shrink-0 border-r border-white/[0.07] bg-black/25">
            <StrategyBuilder
              onResult={(r) => {
                setResult(r);
                setMeta({ source: "live" });
                setResultKey((k) => k + 1);
                setError("");
              }}
              onError={setError}
              onLoading={(b, label) => {
                setLoading(b);
                if (label) setLoadingLabel(label);
              }}
            />
            <div
              onPointerDown={startDrag}
              onPointerMove={onDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onDoubleClick={() => {
                setSidebarW(SIDEBAR_DEFAULT);
                widthRef.current = SIDEBAR_DEFAULT;
                localStorage.setItem(SIDEBAR_KEY, String(SIDEBAR_DEFAULT));
              }}
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize · double-click to reset"
              className="group absolute -right-1.5 top-0 z-20 flex h-full w-3 cursor-col-resize justify-center"
            >
              <div className={`h-full w-px transition-all ${dragging ? "w-[2px] bg-lava-500 shadow-[0_0_12px_#ff6a3d]" : "bg-transparent group-hover:w-[2px] group-hover:bg-lava-500/70"}`} />
            </div>
          </aside>

          <section className="canvas min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1240px] px-6 py-6">
              {loading ? (
                <ResultsSkeleton label={loadingLabel} />
              ) : result ? (
                <ResultsPanel key={resultKey} result={result} meta={meta} />
              ) : null}
            </div>
          </section>
        </main>

        <CommandPalette open={paletteOpen} onClose={closePalette} mod={mod} />
        <ReferencePanel open={docs.open} tab={docs.tab} focus={docs.focus} query={docs.query} onClose={() => setDocs({ open: false })} />
        <AlphaHistoryPanel
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onLoad={(expr) => {
            setHistoryOpen(false);
            emit("load-expression", expr);
          }}
        />
        <GalleryPanel open={galleryOpen} onClose={() => setGalleryOpen(false)} />
        <LearnPanel open={learn.open} tab={learn.tab} onTab={(tab) => setLearn({ open: true, tab })} onClose={() => setLearn((l) => ({ ...l, open: false }))} />
        <LandingModal open={landing.open} onDismiss={landing.dismiss} />
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

function MobileView() {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-dvh pb-10">
        <header className="flex items-center gap-3 px-5 pb-4 pt-6">
          <LogoMark size={36} />
          <div>
            <h1 className="text-lg font-semibold leading-none tracking-tight text-white">LavaQuant</h1>
            <p className="mt-1 text-xs text-gray-500">Quantitative alpha research · Drew Pilat, UChicago MS CS</p>
          </div>
        </header>

        <div className="px-4">
          <div className="panel-flat mb-4 px-4 py-3 text-xs leading-relaxed text-gray-400">
            The editor and workbench need a larger screen. Here is a sample result from the platform; open this page on a laptop to write and backtest your own alphas.
          </div>
          <div className="canvas">
            <ResultsPanel result={FEATURED_ALPHA} meta={{ source: "sample" }} />
          </div>
        </div>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
