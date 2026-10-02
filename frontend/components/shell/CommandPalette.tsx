"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, Braces, Brain, Clock, CornerDownLeft, FlaskConical, Hash, Link2, Play, Search, Sigma, Sparkles, Wand2, ClipboardCopy, Info, Layers,
} from "lucide-react";
import { DEFAULT_EXAMPLES, DSL_FIELDS, DSL_FUNCTIONS } from "@/lib/dsl";
import { METRICS } from "@/lib/metrics";
import { emit } from "@/lib/bus";

type Group = "Actions" | "Examples" | "Operators" | "Fields" | "Metrics";

interface Item {
  id: string;
  group: Group;
  title: string;
  hint?: string;
  keywords?: string;
  icon: React.ReactNode;
  mono?: boolean;
  run: () => void;
}

const GROUP_ORDER: Group[] = ["Actions", "Examples", "Operators", "Fields", "Metrics"];
const snippetToText = (s: string) => s.replace(/\$\{\d+:([^}]*)\}/g, "$1");

function scoreItem(q: string, it: Item): number {
  if (!q) return 1;
  const title = it.title.toLowerCase();
  const hay = `${title} ${(it.keywords ?? "").toLowerCase()} ${(it.hint ?? "").toLowerCase()}`;
  if (title === q) return 200;
  if (title.startsWith(q)) return 120;
  const ti = title.indexOf(q);
  if (ti >= 0) return 90 - ti * 0.2;
  const hi = hay.indexOf(q);
  if (hi >= 0) return 50 - hi * 0.05;
  let i = 0;
  for (const ch of title) {
    if (ch === q[i]) i++;
    if (i === q.length) return 20;
  }
  return 0;
}

export function CommandPalette({ open, onClose, mod }: { open: boolean; onClose: () => void; mod: string }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    const act = (fn: () => void) => () => {
      onClose();
      window.setTimeout(fn, 60);
    };
    const ic = "h-3.5 w-3.5";
    const actions: Item[] = [
      { id: "run", group: "Actions", title: "Run backtest", hint: `${mod} ↵`, keywords: "execute simulate go", icon: <Play className={ic} />, run: act(() => emit("run")) },
      { id: "brain", group: "Actions", title: "Submit to WorldQuant BRAIN", keywords: "wq worldquant simulate fitness", icon: <Brain className={ic} />, run: act(() => { emit("set-mode", "expression"); window.setTimeout(() => emit("submit-brain"), 80); }) },
      { id: "mode-expr", group: "Actions", title: "Switch to Expression alpha", keywords: "editor dsl mode", icon: <Braces className={ic} />, run: act(() => emit("set-mode", "expression")) },
      { id: "mode-ml", group: "Actions", title: "Switch to ML model", keywords: "lightgbm machine learning mode", icon: <Layers className={ic} />, run: act(() => emit("set-mode", "ml")) },
      { id: "link", group: "Actions", title: "Copy shareable link", hint: "this alpha", keywords: "share url", icon: <Link2 className={ic} />, run: act(() => emit("copy-link")) },
      { id: "summary", group: "Actions", title: "Copy results summary", hint: "plain text", keywords: "share export clipboard", icon: <ClipboardCopy className={ic} />, run: act(() => emit("copy-summary")) },
      { id: "history", group: "Actions", title: "Open alpha history", keywords: "past runs saved", icon: <Clock className={ic} />, run: act(() => emit("open-history")) },
      { id: "docs", group: "Actions", title: "Open docs", keywords: "reference help glossary", icon: <BookOpen className={ic} />, run: act(() => emit("open-docs")) },
      { id: "about", group: "Actions", title: "About lavaquant", keywords: "intro welcome author", icon: <Info className={ic} />, run: act(() => emit("open-about")) },
    ];
    const examples: Item[] = DEFAULT_EXAMPLES.map((e) => ({
      id: `ex-${e.name}`,
      group: "Examples",
      title: e.name,
      hint: e.expression,
      keywords: e.description,
      icon: <Sparkles className={ic} />,
      run: act(() => emit("load-expression", e.expression)),
    }));
    const ops: Item[] = DSL_FUNCTIONS.map((f) => ({
      id: `fn-${f.name}`,
      group: "Operators",
      title: f.sig,
      hint: f.doc,
      keywords: `${f.name} ${f.cat}`,
      mono: true,
      icon: <FlaskConical className={ic} />,
      run: act(() => emit("insert-text", snippetToText(f.snippet))),
    }));
    const fields: Item[] = DSL_FIELDS.map((f) => ({
      id: `fd-${f.name}`,
      group: "Fields",
      title: f.name,
      hint: f.doc,
      mono: true,
      icon: <Hash className={ic} />,
      run: act(() => emit("insert-text", f.name)),
    }));
    const metrics: Item[] = METRICS.map((m) => ({
      id: `mt-${m.key}`,
      group: "Metrics",
      title: `${m.label}: what it means`,
      hint: m.formula,
      keywords: m.name,
      icon: <Sigma className={ic} />,
      run: act(() => emit("open-docs", { tab: "metrics", focus: m.key })),
    }));
    return [...actions, ...examples, ...ops, ...fields, ...metrics];
  }, [mod, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const perGroup = q ? 7 : 6;
    const groups = GROUP_ORDER.map((g) => {
      const scored = items
        .filter((i) => i.group === g)
        .map((i) => ({ i, s: scoreItem(q, i) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, g === "Actions" && !q ? 9 : perGroup);
      return { g, scored, best: scored[0]?.s ?? 0 };
    });
    // With a query, the group holding the best match goes first (stable otherwise)
    if (q) groups.sort((a, b) => b.best - a.best);
    return groups.flatMap((x) => x.scored.map((s) => s.i));
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[active]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  let lastGroup: Group | null = null;

  return (
    <div className="fixed inset-0 z-[90]" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="panel animate-pop-in relative mx-auto mt-[11vh] w-[min(680px,92vw)] overflow-hidden !rounded-2xl shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lava-500/70 to-transparent" />
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
          <Search className="h-4 w-4 text-lava-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, operator, example or metric…"
            className="h-14 flex-1 bg-transparent text-[15px] text-white placeholder:text-gray-600 focus:outline-none"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="kbd">esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Wand2 className="h-5 w-5 text-gray-600" />
              <p className="text-sm text-gray-400">Nothing matches &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-gray-600">Try an operator like ts_corr, a metric like Sharpe, or an action like run.</p>
            </div>
          )}
          {results.map((it, idx) => {
            const header = it.group !== lastGroup;
            lastGroup = it.group;
            const isActive = idx === active;
            return (
              <div key={it.id}>
                {header && <div className="eyebrow px-3 pb-1 pt-3 first:pt-1">{it.group}</div>}
                <button
                  data-idx={idx}
                  onMouseMove={() => setActive(idx)}
                  onClick={it.run}
                  className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${isActive ? "bg-white/[0.07]" : ""}`}
                >
                  {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-lava-gradient" />}
                  <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border ${isActive ? "border-lava-500/40 bg-lava-500/15 text-lava-300" : "border-white/[0.08] bg-white/[0.03] text-gray-500"}`}>
                    {it.icon}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-[13px] ${it.mono ? "font-mono text-[12.5px]" : "font-medium"} ${isActive ? "text-white" : "text-gray-300"}`}>
                    {it.title}
                  </span>
                  {it.hint && (
                    <span className={`max-w-[48%] truncate text-xs ${it.group === "Examples" || it.group === "Metrics" ? "font-mono text-[11px]" : ""} text-gray-600`}>{it.hint}</span>
                  )}
                  {isActive && <CornerDownLeft className="h-3 w-3 flex-shrink-0 text-gray-500" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-white/[0.07] bg-black/30 px-4 py-2.5 text-[11px] text-gray-600">
          <span className="flex items-center gap-1.5"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> navigate</span>
          <span className="flex items-center gap-1.5"><kbd className="kbd">↵</kbd> select</span>
          <span className="ml-auto">Operators and fields insert into the editor</span>
        </div>
      </div>
    </div>
  );
}
