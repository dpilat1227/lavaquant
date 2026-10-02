"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  Search,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { METRICS } from "@/lib/metrics";
import {
  OPERATOR_DOCS,
  FEATURE_DOCS,
  PAPERS,
  NEWS_ITEMS,
  NEWS_CATEGORIES,
  getResourcesForTag,
} from "@/lib/references";
import type { OperatorDoc, FeatureDoc, NewsItem, NewsCategory } from "@/lib/references";
import { cn } from "@/lib/utils";

// ── WQ Data Fields ─────────────────────────────────────────────────────────────

interface WQField {
  name: string;
  type: string;
  description: string;
  note?: string;
}

const WQ_FIELDS: { group: string; color: string; fields: WQField[] }[] = [
  {
    group: "Price",
    color: "text-lava-400",
    fields: [
      { name: "close",   type: "float", description: "Adjusted closing price" },
      { name: "open",    type: "float", description: "Opening price" },
      { name: "high",    type: "float", description: "Daily high" },
      { name: "low",     type: "float", description: "Daily low" },
      { name: "vwap",    type: "float", description: "Volume-weighted average price" },
    ],
  },
  {
    group: "Returns",
    color: "text-emerald-400",
    fields: [
      { name: "returns", type: "float", description: "Daily return: close/prev_close − 1", note: "Most commonly used return field" },
      { name: "log_ret", type: "float", description: "Log return: ln(close/prev_close)" },
    ],
  },
  {
    group: "Volume",
    color: "text-sky-400",
    fields: [
      { name: "volume",  type: "float", description: "Raw daily trading volume" },
      { name: "adv5",    type: "float", description: "5-day average daily dollar volume" },
      { name: "adv10",   type: "float", description: "10-day average daily dollar volume" },
      { name: "adv20",   type: "float", description: "20-day average daily dollar volume", note: "Standard liquidity proxy — use instead of raw volume" },
      { name: "adv60",   type: "float", description: "60-day average daily dollar volume" },
      { name: "adv120",  type: "float", description: "120-day average daily dollar volume" },
    ],
  },
  {
    group: "Fundamental",
    color: "text-amber-400",
    fields: [
      { name: "cap",     type: "float", description: "Market capitalization (shares × close)" },
      { name: "shares",  type: "float", description: "Shares outstanding" },
    ],
  },
  {
    group: "Classification",
    color: "text-violet-400",
    fields: [
      { name: "sector",      type: "int", description: "GICS sector code — use with group operators", note: "Arg to group_neutralize, group_rank, etc." },
      { name: "industry",    type: "int", description: "GICS industry code" },
      { name: "subindustry", type: "int", description: "GICS sub-industry code (finest grouping)" },
      { name: "market",      type: "int", description: "Market identifier — for cross-market expressions" },
    ],
  },
];

type TabKey = "metrics" | "operators" | "features" | "wqfields" | "papers" | "news";

interface ReferencePanelProps {
  open: boolean;
  onClose: () => void;
  /** Tab to show when opening */
  tab?: string;
  /** Glossary entry (metric key) to scroll to and highlight */
  focus?: string;
  /** Pre-filled search */
  query?: string;
}

const TAB_KEYS: TabKey[] = ["metrics", "operators", "features", "wqfields", "papers", "news"];

const CATEGORY_LABELS: Record<OperatorDoc["category"], string> = {
  cross_sectional: "Cross-Sectional",
  time_series: "Time-Series",
  group: "Group",
  element_wise: "Element-Wise",
};

const NEWS_CATEGORY_COLORS: Record<NewsCategory, string> = {
  "Factor Research": "bg-lava-500/15 text-lava-300 border-lava-500/25",
  "AI & ML":         "bg-violet-500/15 text-violet-300 border-violet-500/25",
  "Industry":        "bg-sky-500/15 text-sky-300 border-sky-500/25",
  "Regulation":      "bg-amber-500/15 text-amber-300 border-amber-500/25",
  "Markets":         "bg-rose-500/15 text-rose-300 border-rose-500/25",
  "Competition":     "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
};

// ── Accordion item ─────────────────────────────────────────────────────────────

function AccordionItem({
  trigger,
  children,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-2.5 text-left hover:text-white transition-colors text-gray-300"
      >
        <span className="flex-1 min-w-0">{trigger}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-gray-500 flex-shrink-0 ml-2" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-gray-500 flex-shrink-0 ml-2" />
        )}
      </button>
      {open && <div className="pb-3 space-y-2">{children}</div>}
    </div>
  );
}

// ── Resource links (one-line compact) ─────────────────────────────────────────

function ResourceLinks({ tag }: { tag: string }) {
  const { videos, posts } = getResourcesForTag(tag);
  if (!videos.length && !posts.length) return null;

  return (
    <div className="space-y-1 pt-1">
      {videos.map((v) => (
        <a
          key={v.url}
          href={v.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors group"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0 group-hover:text-lava-400" />
          <span className="text-gray-500">{v.channel}</span>
          <span className="text-gray-700">·</span>
          <span className="text-gray-600 truncate">{v.title}</span>
          <span className="text-gray-700 flex-shrink-0">· {v.duration}</span>
        </a>
      ))}
      {posts.map((p) => (
        <a
          key={p.url}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors group"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0 group-hover:text-lava-400" />
          <span className="text-gray-500">{p.source}</span>
          <span className="text-gray-700">·</span>
          <span className="text-gray-600 truncate">{p.title}</span>
          <span className="text-gray-700 flex-shrink-0">· {p.date}</span>
        </a>
      ))}
    </div>
  );
}

// ── Operator entry ─────────────────────────────────────────────────────────────

function OperatorEntry({ doc }: { doc: OperatorDoc }) {
  return (
    <AccordionItem
      trigger={
        <span className="font-mono text-sm text-lava-300">{doc.signature}</span>
      }
    >
      <div className="space-y-2 pl-1">
        {doc.formula && (
          <code className="block text-xs text-gray-300 font-mono bg-white/[0.06] rounded px-2 py-1.5 whitespace-pre-wrap">
            {doc.formula}
          </code>
        )}
        <p className="text-sm text-gray-400 leading-snug">{doc.description}</p>
        {doc.intuition && (
          <p className="text-sm text-gray-500 italic leading-snug">{doc.intuition}</p>
        )}
        {doc.papers.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {doc.papers.map((key) =>
              PAPERS[key] ? (
                <a
                  key={key}
                  href={PAPERS[key].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-gray-500 hover:text-lava-400 border border-white/10 hover:border-lava-500/30 rounded px-1.5 py-0.5 transition-colors"
                >
                  [{key}]
                </a>
              ) : null
            )}
          </div>
        )}
        {doc.examples.length > 0 && (
          <div className="space-y-1 pt-0.5">
            {doc.examples.map((ex, i) => (
              <code
                key={i}
                className="block text-xs text-gray-400 font-mono bg-white/[0.06] rounded px-2 py-1"
              >
                {ex}
              </code>
            ))}
          </div>
        )}
        <ResourceLinks tag={doc.name} />
      </div>
    </AccordionItem>
  );
}

// ── Feature entry ──────────────────────────────────────────────────────────────

function FeatureEntry({ doc }: { doc: FeatureDoc }) {
  return (
    <AccordionItem
      trigger={
        <span className="font-mono text-sm text-lava-300">{doc.name}</span>
      }
    >
      <div className="space-y-2 pl-1">
        {doc.formula && (
          <code className="block text-xs text-gray-300 font-mono bg-white/[0.06] rounded px-2 py-1.5 whitespace-pre-wrap">
            {doc.formula}
          </code>
        )}
        <p className="text-sm text-gray-400 leading-snug">{doc.description}</p>
        {doc.intuition && (
          <p className="text-sm text-gray-500 italic leading-snug">{doc.intuition}</p>
        )}
        {doc.papers.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {doc.papers.map((key) =>
              PAPERS[key] ? (
                <a
                  key={key}
                  href={PAPERS[key].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-gray-500 hover:text-lava-400 border border-white/10 hover:border-lava-500/30 rounded px-1.5 py-0.5 transition-colors"
                >
                  [{key}]
                </a>
              ) : null
            )}
          </div>
        )}
        <ResourceLinks tag={doc.name} />
      </div>
    </AccordionItem>
  );
}

// ── News card ──────────────────────────────────────────────────────────────────

function NewsCard({
  item,
  expanded,
  onToggle,
}: {
  item: NewsItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const badgeClass =
    NEWS_CATEGORY_COLORS[item.category] ??
    "bg-white/10 text-gray-400 border-white/20";

  return (
    <div className="bg-white/[0.05] border border-white/10 rounded-xl p-4 space-y-2">
      {/* Top row: category pill + notable badge + date */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${badgeClass}`}
        >
          {item.category}
        </span>
        {item.isHot && (
          <span className="text-[10px] text-amber-400 font-medium flex items-center gap-0.5">
            <span className="text-[8px]">●</span> Notable
          </span>
        )}
        <span className="text-[10px] text-gray-600 ml-auto font-mono">{item.date}</span>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-gray-100 leading-snug">{item.title}</p>

      {/* Source */}
      <p className="text-xs text-gray-500">{item.source}</p>

      {/* Summary */}
      <p
        className={cn(
          "text-xs text-gray-400 leading-relaxed",
          !expanded && "line-clamp-3"
        )}
      >
        {item.summary}
      </p>

      {/* Controls */}
      <div className="flex items-center gap-3 pt-0.5">
        <button
          onClick={onToggle}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-lava-400 hover:text-lava-300 transition-colors flex items-center gap-1"
        >
          Read more
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function ReferencePanel({ open, onClose, tab: tabProp, focus, query: queryProp }: ReferencePanelProps) {
  const [tab, setTab] = useState<TabKey>("metrics");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<NewsCategory | "All">("All");
  const [expandedNews, setExpandedNews] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Each time the panel opens, jump to the requested tab / glossary entry
  useEffect(() => {
    if (!open) return;
    setTab(TAB_KEYS.includes(tabProp as TabKey) ? (tabProp as TabKey) : "metrics");
    setQuery(queryProp ?? "");
    if (!focus) return;
    setFlash(focus);
    const t1 = window.setTimeout(() => {
      contentRef.current?.querySelector<HTMLElement>(`[data-metric="${focus}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 120);
    const t2 = window.setTimeout(() => setFlash(null), 2400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, tabProp, focus, queryProp]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function toggleExpanded(id: string) {
    setExpandedNews((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredOperators = useMemo(() => {
    if (!query.trim()) return OPERATOR_DOCS;
    const q = query.toLowerCase();
    return OPERATOR_DOCS.filter(
      (op) =>
        op.name.toLowerCase().includes(q) ||
        op.description.toLowerCase().includes(q) ||
        op.signature.toLowerCase().includes(q)
    );
  }, [query]);

  const groupedOperators = useMemo(() => {
    const groups: Partial<Record<OperatorDoc["category"], OperatorDoc[]>> = {};
    for (const op of filteredOperators) {
      if (!groups[op.category]) groups[op.category] = [];
      groups[op.category]!.push(op);
    }
    return groups;
  }, [filteredOperators]);

  const featureList = useMemo(() => {
    const all = Object.values(FEATURE_DOCS);
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    );
  }, [query]);

  const groupedFeatures = useMemo(() => {
    const groups: Record<string, FeatureDoc[]> = {};
    for (const f of featureList) {
      if (!groups[f.category]) groups[f.category] = [];
      groups[f.category].push(f);
    }
    return groups;
  }, [featureList]);

  const filteredPapers = useMemo(() => {
    const all = Object.values(PAPERS);
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        p.journal.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q)
    );
  }, [query]);

  const filteredNews = useMemo(() => {
    let items = NEWS_ITEMS;
    if (activeCategory !== "All") {
      items = items.filter((n) => n.category === activeCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.summary.toLowerCase().includes(q)
      );
    }
    return items;
  }, [query, activeCategory]);

  if (!open) return null;

  const TABS: { key: TabKey; label: string }[] = [
    { key: "metrics", label: "Metrics" },
    { key: "operators", label: "Operators" },
    { key: "features", label: "Features" },
    { key: "wqfields", label: "WQ Fields" },
    { key: "papers", label: "Papers" },
    { key: "news", label: "News" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] animate-fade-in bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />

      {/* Drawer */}
      <div className="animate-slide-in-right fixed right-0 top-0 z-[70] flex h-full w-[440px] max-w-[94vw] flex-col border-l border-white/10 bg-[#0b0b0e]/95 shadow-[-30px_0_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 text-lava-400" />
            <span className="text-sm font-semibold text-gray-100">Docs</span>
            <span className="text-xs text-gray-600">metrics · operators · research</span>
          </div>
          <button onClick={onClose} className="text-gray-500 transition-colors hover:text-white" aria-label="Close docs">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="flex-shrink-0 border-b border-white/[0.07] px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-600" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search operators, features, papers…"
              className="field !pl-9"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 gap-4 overflow-x-auto border-b border-white/[0.07] px-5">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 py-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] transition-colors",
                tab === key ? "border-lava-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-5 py-2">

          {/* Metrics glossary */}
          {tab === "metrics" && (
            <div className="space-y-2.5 py-3">
              {METRICS.filter((m) => {
                const q = query.trim().toLowerCase();
                return !q || `${m.label} ${m.name} ${m.short} ${m.long}`.toLowerCase().includes(q);
              }).map((m) => (
                <div
                  key={m.key}
                  data-metric={m.key}
                  className={cn(
                    "scroll-mt-3 rounded-xl border p-4 transition-all duration-700",
                    flash === m.key
                      ? "border-lava-500/50 bg-lava-500/[0.08] shadow-[0_0_30px_-8px_rgba(255,106,61,0.5)]"
                      : "border-white/[0.07] bg-white/[0.02]"
                  )}
                >
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className={`font-mono text-sm font-bold ${m.color}`}>{m.label}</span>
                    <span className="text-xs font-medium text-gray-400">{m.name}</span>
                  </div>
                  <code className="mb-2.5 block rounded-md bg-black/30 px-2 py-1.5 font-mono text-[11px] text-gray-500">{m.formula}</code>
                  <p className="text-[13px] leading-relaxed text-gray-300">{m.short}</p>
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">{m.long}</p>
                  <span className="mt-3 inline-block rounded-md border border-lava-500/25 bg-lava-500/10 px-2 py-0.5 font-mono text-[10px] text-lava-300">{m.threshold}</span>
                </div>
              ))}
            </div>
          )}

          {/* Operators */}
          {tab === "operators" && (
            <div>
              {(Object.keys(groupedOperators) as OperatorDoc["category"][]).map((cat) => (
                <div key={cat} className="mb-3">
                  <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest py-2 sticky top-0 bg-gray-900">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </p>
                  {groupedOperators[cat]!.map((op) => (
                    <OperatorEntry key={op.name} doc={op} />
                  ))}
                </div>
              ))}
              {filteredOperators.length === 0 && (
                <p className="text-sm text-gray-600 py-6 text-center">
                  No operators match &ldquo;{query}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Features */}
          {tab === "features" && (
            <div>
              {Object.entries(groupedFeatures).map(([cat, features]) => (
                <div key={cat} className="mb-3">
                  <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest py-2 sticky top-0 bg-gray-900">
                    {cat}
                  </p>
                  {features.map((f) => (
                    <FeatureEntry key={f.name} doc={f} />
                  ))}
                </div>
              ))}
              {featureList.length === 0 && (
                <p className="text-sm text-gray-600 py-6 text-center">
                  No features match &ldquo;{query}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* WQ Fields */}
          {tab === "wqfields" && (
            <div className="py-2">
              {/* Context note */}
              <div className="mb-4 rounded-lg border border-lava-500/20 bg-lava-950/20 px-3 py-2.5 text-xs text-gray-400 leading-relaxed">
                These are WorldQuant BRAIN&apos;s native data fields — available in your alpha expressions when submitting to BRAIN.
                Use <code className="text-lava-300 font-mono">adv20</code> instead of <code className="text-lava-300 font-mono">volume_ratio</code>, and <code className="text-lava-300 font-mono">returns</code> for daily returns.
              </div>

              {WQ_FIELDS.filter((group) =>
                !query.trim() ||
                group.fields.some(
                  (f) =>
                    f.name.includes(query.toLowerCase()) ||
                    f.description.toLowerCase().includes(query.toLowerCase())
                )
              ).map((group) => (
                <div key={group.group} className="mb-4">
                  <p className={`text-[10px] font-semibold uppercase tracking-widest py-2 sticky top-0 bg-gray-900 ${group.color}`}>
                    {group.group}
                  </p>
                  <div className="space-y-0">
                    {group.fields
                      .filter(
                        (f) =>
                          !query.trim() ||
                          f.name.includes(query.toLowerCase()) ||
                          f.description.toLowerCase().includes(query.toLowerCase())
                      )
                      .map((field) => (
                        <div
                          key={field.name}
                          className="flex items-start gap-3 py-2 border-b border-white/[0.05] last:border-0"
                        >
                          <code className="font-mono text-sm text-lava-300 flex-shrink-0 w-24">{field.name}</code>
                          <div className="min-w-0">
                            <p className="text-xs text-gray-400 leading-snug">{field.description}</p>
                            {field.note && (
                              <p className="text-[10px] text-lava-500/70 mt-0.5 italic">{field.note}</p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Papers */}
          {tab === "papers" && (
            <div className="space-y-2.5 py-2">
              {filteredPapers.map((paper) => (
                <div
                  key={paper.key}
                  className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-mono text-lava-400 flex-shrink-0 mt-0.5">
                      [{paper.key}]
                    </span>
                    <a
                      href={paper.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                      aria-label="Open paper"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <p className="text-sm text-gray-200 leading-snug">{paper.title}</p>
                  <p className="text-xs text-gray-500">
                    {paper.authors} · {paper.journal} · {paper.year}
                  </p>
                </div>
              ))}
              {filteredPapers.length === 0 && (
                <p className="text-sm text-gray-600 py-6 text-center">
                  No papers match &ldquo;{query}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* News */}
          {tab === "news" && (
            <div className="space-y-3 py-2">
              {/* Category filter pills */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveCategory("All")}
                  className={cn(
                    "text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border transition-colors",
                    activeCategory === "All"
                      ? "bg-lava-600 text-white border-lava-600"
                      : "bg-white/5 text-gray-400 hover:bg-white/10 border-white/10"
                  )}
                >
                  All
                </button>
                {NEWS_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border transition-colors",
                      activeCategory === cat
                        ? "bg-lava-600 text-white border-lava-600"
                        : "bg-white/5 text-gray-400 hover:bg-white/10 border-white/10"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* News cards */}
              {filteredNews.map((item) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  expanded={expandedNews.has(item.id)}
                  onToggle={() => toggleExpanded(item.id)}
                />
              ))}
              {filteredNews.length === 0 && (
                <p className="text-sm text-gray-600 py-6 text-center">
                  No items match your filters
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
