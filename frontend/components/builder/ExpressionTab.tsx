"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, CircleAlert, Info } from "lucide-react";
import type { Monaco, OnMount } from "@monaco-editor/react";
import { BacktestControls } from "./BacktestControls";
import { RunButton, StickyFooter } from "./RunBar";
import { WQSettingsPanel, WQ_DEFAULT_SETTINGS } from "./WQSettingsPanel";
import type { WQSettings } from "./WQSettingsPanel";
import type { EditorCommand } from "./StrategyBuilder";
import { WQConnectModal, loadWQCredentials } from "@/components/ui/WQConnectModal";
import { WQResults } from "@/components/results/WQResults";
import { runExpressionBacktest, submitToWQBrain } from "@/lib/api";
import { checkWQCompat } from "@/lib/wqCompat";
import { addLocalResult, addWQResult } from "@/lib/alphaHistory";
import { applyMarkers, DEFAULT_EXAMPLES, LANG_ID, setupMonaco, THEME_ID, validateExpression } from "@/lib/dsl";
import { EXAMPLE_CITATIONS, PAPERS } from "@/lib/references";
import { emit, toast, useBus } from "@/lib/bus";
import { readAlphaParam } from "@/lib/share";
import { useModKey } from "@/lib/useModKey";
import type { BacktestResponse, Universe, WQCredentials, WQSimResult } from "@/lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="shimmer h-[132px] w-full rounded-xl" />,
});

type Editor = Parameters<OnMount>[0];

const DEFAULT_EXPRESSION = "rank(-ts_delta(close, 5))";

interface ExpressionTabProps {
  onResult: (r: BacktestResponse) => void;
  onError: (msg: string) => void;
  onLoading: (b: boolean, label?: string) => void;
  command: EditorCommand | null;
  onCommandHandled: () => void;
}

export function ExpressionTab({ onResult, onError, onLoading, command, onCommandHandled }: ExpressionTabProps) {
  const mod = useModKey();
  const [expression, setExpression] = useState(DEFAULT_EXPRESSION);
  const [universe, setUniverse] = useState<Universe>("sp500");
  const [startDate, setStartDate] = useState("2020-01-01");
  const [endDate, setEndDate] = useState("2024-12-31");
  const [forwardDays, setForwardDays] = useState(5);
  const [sectorNeutral, setSectorNeutral] = useState(false);
  const [loading, setLoading] = useState(false);
  const [monoFont, setMonoFont] = useState("monospace");

  // WorldQuant BRAIN
  const [wqModalOpen, setWqModalOpen] = useState(false);
  const [wqLoading, setWqLoading] = useState(false);
  const [wqResult, setWqResult] = useState<WQSimResult | null>(null);
  const [wqError, setWqError] = useState("");
  const [wqSettings, setWqSettings] = useState<WQSettings>(WQ_DEFAULT_SETTINGS);

  const editorRef = useRef<Editor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const diags = useMemo(() => validateExpression(expression), [expression]);
  const errors = diags.filter((d) => d.severity === "error");
  const warnings = diags.filter((d) => d.severity === "warning");
  const wqWarnings = checkWQCompat(expression);
  const matchedExample = DEFAULT_EXAMPLES.find((e) => e.expression === expression.trim());

  useEffect(() => {
    const v = getComputedStyle(document.body).getPropertyValue("--font-geist-mono").trim();
    if (v) setMonoFont(`${v}, ui-monospace, monospace`);
  }, []);

  // Push diagnostics into Monaco as squiggles
  useEffect(() => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (monaco && model) applyMarkers(monaco, model, diags);
  }, [diags]);

  // Commands from the palette / history / examples
  useEffect(() => {
    if (!command) return;
    if (command.type === "load") {
      setExpression(command.text);
      editorRef.current?.focus();
    } else {
      const ed = editorRef.current;
      if (ed) {
        const sel = ed.getSelection();
        if (sel) ed.executeEdits("palette", [{ range: sel, text: command.text, forceMoveMarkers: true }]);
        ed.focus();
      } else {
        setExpression((prev) => (prev.trim() ? `${prev} ${command.text}` : command.text));
      }
    }
    onCommandHandled();
  }, [command, onCommandHandled]);

  const handleRun = useCallback(async () => {
    const expr = expression.trim();
    if (!expr || loading) return;
    if (errors.length) {
      toast(`Fix ${errors.length} syntax ${errors.length === 1 ? "error" : "errors"} first: ${errors[0].message}`, "error");
      return;
    }
    setLoading(true);
    onLoading(true, "Running backtest");
    onError("");
    try {
      const result = await runExpressionBacktest({
        expression: expr,
        universe,
        start_date: startDate,
        end_date: endDate,
        forward_days: forwardDays,
        long_short_pct: 0.2,
        sector_neutral: sectorNeutral,
      });
      onResult(result);
      addLocalResult(expr, {
        sharpe: result.metrics.sharpe,
        ic_mean: result.metrics.ic_mean,
        ic_ir: result.metrics.ic_ir,
        annual_return: result.metrics.annual_return,
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
      onLoading(false);
    }
  }, [expression, loading, errors, universe, startDate, endDate, forwardDays, sectorNeutral, onLoading, onError, onResult]);

  const handleWQSubmit = useCallback(
    async (creds?: WQCredentials) => {
      const credentials = creds ?? loadWQCredentials();
      if (!credentials) {
        setWqModalOpen(true);
        return;
      }
      const expr = expression.trim();
      if (!expr) return;

      setWqLoading(true);
      setWqError("");
      setWqResult(null);
      try {
        const result = await submitToWQBrain({
          ...credentials,
          expression: expr,
          universe: wqSettings.universe,
          neutralization: wqSettings.neutralization,
          delay: wqSettings.delay,
          decay: wqSettings.decay,
        });
        setWqResult(result);
        if (result.metrics) {
          addWQResult(expr, result.metrics, {
            universe: wqSettings.universe,
            neutralization: wqSettings.neutralization,
            delay: wqSettings.delay,
          });
        }
      } catch (e) {
        setWqError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setWqLoading(false);
      }
    },
    [expression, wqSettings]
  );

  useBus("run", () => void handleRun());
  useBus("submit-brain", () => void handleWQSubmit());

  // Open a shared link: load the alpha and run it once.
  const linkHandled = useRef(false);
  useEffect(() => {
    if (linkHandled.current) return;
    linkHandled.current = true;
    const shared = readAlphaParam();
    if (shared) {
      setExpression(shared);
      toast("Loaded alpha from link");
      window.setTimeout(() => emit("run"), 700);
    }
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => emit("run"));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => emit("open-palette"));
    const model = editor.getModel();
    if (model) applyMarkers(monaco, model, validateExpression(model.getValue()));
    document.fonts?.ready.then(() => monaco.editor.remeasureFonts());
  };

  const status =
    !expression.trim()
      ? { tone: "idle" as const, text: "Write an expression to begin" }
      : errors.length
        ? { tone: "error" as const, text: errors[0].message }
        : warnings.length
          ? { tone: "warn" as const, text: warnings[0].message }
          : diags.length
            ? { tone: "info" as const, text: diags[0].message }
            : { tone: "ok" as const, text: "Valid syntax" };

  const citations = matchedExample ? EXAMPLE_CITATIONS[matchedExample.name] ?? [] : [];

  return (
    <div className="space-y-5">
      {/* Editor */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="eyebrow">Alpha expression</span>
          <span
            className={`flex items-center gap-1.5 text-[11px] ${
              status.tone === "ok" ? "text-up" : status.tone === "error" ? "text-down" : status.tone === "warn" ? "text-amber-400" : status.tone === "info" ? "text-sky-400" : "text-gray-600"
            }`}
          >
            {status.tone === "ok" && <CheckCircle2 className="h-3 w-3" />}
            {status.tone === "error" && <CircleAlert className="h-3 w-3" />}
            {status.tone === "warn" && <AlertTriangle className="h-3 w-3" />}
            {status.tone === "info" && <Info className="h-3 w-3" />}
            <span className="max-w-[260px] truncate">{status.text}</span>
          </span>
        </div>

        <div className="group relative overflow-hidden rounded-xl border border-white/[0.09] bg-[#0c0c0f] shadow-[inset_0_2px_12px_rgba(0,0,0,0.5)] transition-all focus-within:border-lava-500/50 focus-within:shadow-[inset_0_2px_12px_rgba(0,0,0,0.5),0_0_0_3px_rgba(255,106,61,0.12),0_0_40px_-12px_rgba(255,106,61,0.5)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-lava-500/50 to-transparent opacity-0 transition-opacity group-focus-within:opacity-100" />
          <MonacoEditor
            height="132px"
            language={LANG_ID}
            theme={THEME_ID}
            value={expression}
            onChange={(v) => setExpression(v ?? "")}
            beforeMount={setupMonaco}
            onMount={handleMount}
            options={{
              fontSize: 14,
              lineHeight: 23,
              fontFamily: monoFont,
              fontLigatures: false,
              minimap: { enabled: false },
              lineNumbers: "off",
              glyphMargin: false,
              folding: false,
              lineDecorationsWidth: 14,
              lineNumbersMinChars: 0,
              scrollBeyondLastLine: false,
              wordWrap: "on",
              padding: { top: 14, bottom: 14 },
              renderLineHighlight: "none",
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
              scrollbar: { vertical: "hidden", horizontal: "hidden" },
              contextmenu: false,
              occurrencesHighlight: "off",
              selectionHighlight: false,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              smoothScrolling: true,
              fixedOverflowWidgets: true,
              automaticLayout: true,
              quickSuggestions: { other: true, comments: false, strings: false },
              suggest: { showKeywords: false, showSnippets: true, preview: true },
              placeholder: "e.g. rank(-ts_delta(close, 5))",
            }}
          />
        </div>

        <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-600">
          <span className="flex items-center gap-1">
            <kbd className="kbd">{mod}</kbd>
            <kbd className="kbd">↵</kbd> run
          </span>
          <span className="flex items-center gap-1">
            <kbd className="kbd">{mod}</kbd>
            <kbd className="kbd">K</kbd> commands
          </span>
          <span className="ml-auto">hover any operator for docs</span>
        </div>
      </section>

      {/* WQ field mismatch */}
      {wqWarnings.length > 0 && (
        <div className="animate-pop-in space-y-1.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-3">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
            <span className="text-xs font-semibold text-amber-300">BRAIN field mismatch</span>
          </div>
          {wqWarnings.map((w) => (
            <p key={w.field} className="text-xs leading-relaxed text-amber-200/70">
              <code className="rounded bg-amber-400/10 px-1 font-mono text-amber-200">{w.field}</code> only exists in the local engine. On BRAIN use{" "}
              <code className="rounded bg-amber-400/10 px-1 font-mono text-amber-100">{w.suggestion}</code>.
            </p>
          ))}
        </div>
      )}

      {/* Examples */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="eyebrow">Start from an example</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DEFAULT_EXAMPLES.map((ex) => {
            const active = ex.expression === expression.trim();
            return (
              <button
                key={ex.name}
                onClick={() => {
                  setExpression(ex.expression);
                  editorRef.current?.focus();
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "border-lava-500/50 bg-lava-500/15 text-lava-200 shadow-[0_0_20px_-6px_rgba(255,106,61,0.6)]"
                    : "border-white/[0.08] bg-white/[0.03] text-gray-400 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {ex.name}
              </button>
            );
          })}
        </div>
        {matchedExample && (
          <div className="animate-fade-in mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
            <p className="text-xs leading-relaxed text-gray-400">{matchedExample.description}</p>
            {citations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {citations.map((key) => (
                  <a
                    key={key}
                    href={PAPERS[key]?.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 transition-colors hover:border-lava-500/40 hover:text-lava-300"
                  >
                    {PAPERS[key] ? `${PAPERS[key].authors} ${PAPERS[key].year}` : key}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Backtest parameters */}
      <section>
        <div className="mb-3 eyebrow">Backtest</div>
        <BacktestControls
          universe={universe}
          onUniverseChange={setUniverse}
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
          forwardDays={forwardDays}
          onForwardDaysChange={setForwardDays}
          sectorNeutral={sectorNeutral}
          onSectorNeutralChange={setSectorNeutral}
          showSectorNeutral
        />
      </section>

      {/* BRAIN */}
      <WQSettingsPanel settings={wqSettings} onChange={setWqSettings} />
      {wqWarnings.length > 0 && wqResult === null && !wqLoading && (
        <p className="text-center text-[11px] text-amber-500/70">Fix the field mismatches above before submitting to BRAIN</p>
      )}
      {wqError && <p className="rounded-xl border border-down/25 bg-down/10 px-3.5 py-2.5 text-xs leading-relaxed text-red-200">{wqError}</p>}
      {wqResult && <WQResults result={wqResult} expression={expression} onClear={() => setWqResult(null)} />}

      <WQConnectModal open={wqModalOpen} onClose={() => setWqModalOpen(false)} onConnect={(creds) => void handleWQSubmit(creds)} />

      <StickyFooter>
        <RunButton loading={loading} disabled={!expression.trim()} label="Run backtest" loadingLabel="Running…" hint={`${mod}↵`} onClick={() => void handleRun()} />
        <button
          onClick={() => void handleWQSubmit()}
          disabled={wqLoading || !expression.trim()}
          title="Simulate on WorldQuant BRAIN"
          className="flex h-11 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-medium text-gray-300 transition-all hover:border-lava-500/40 hover:bg-lava-500/10 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Brain className={`h-4 w-4 ${wqLoading ? "animate-pulse text-lava-400" : ""}`} />
          {wqLoading ? "Simulating…" : "BRAIN"}
        </button>
      </StickyFooter>
    </div>
  );
}
