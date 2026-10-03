import type { Monaco } from "@monaco-editor/react";
import { parseExpression, walk } from "./parse";

export const LANG_ID = "lqdsl";
export const THEME_ID = "lavaquant";

export interface DslFunction {
  name: string;
  sig: string;
  snippet: string;
  doc: string;
  cat: "Cross-sectional" | "Time-series" | "Group" | "Element-wise";
}

export interface DslField {
  name: string;
  doc: string;
  /** Only exists on WorldQuant BRAIN, not in the local engine */
  brainOnly?: boolean;
  /** Only exists in the local engine, not on BRAIN */
  localOnly?: boolean;
}

export const DSL_FUNCTIONS: DslFunction[] = [
  { name: "rank", sig: "rank(x)", snippet: "rank(${1:x})", doc: "Cross-sectional percentile rank, scaled to [−1, 1].", cat: "Cross-sectional" },
  { name: "zscore", sig: "zscore(x)", snippet: "zscore(${1:x})", doc: "Cross-sectional z-score.", cat: "Cross-sectional" },
  { name: "demean", sig: "demean(x)", snippet: "demean(${1:x})", doc: "Subtract the cross-sectional mean.", cat: "Cross-sectional" },
  { name: "winsorize", sig: "winsorize(x, pct)", snippet: "winsorize(${1:x}, ${2:0.05})", doc: "Clip the top and bottom pct of values to tame outliers.", cat: "Cross-sectional" },
  { name: "ts_mean", sig: "ts_mean(x, d)", snippet: "ts_mean(${1:x}, ${2:20})", doc: "Rolling d-day mean per asset.", cat: "Time-series" },
  { name: "ts_std", sig: "ts_std(x, d)", snippet: "ts_std(${1:x}, ${2:20})", doc: "Rolling d-day standard deviation per asset.", cat: "Time-series" },
  { name: "ts_sum", sig: "ts_sum(x, d)", snippet: "ts_sum(${1:x}, ${2:5})", doc: "Rolling d-day total per asset.", cat: "Time-series" },
  { name: "ts_max", sig: "ts_max(x, d)", snippet: "ts_max(${1:x}, ${2:252})", doc: "Highest value of x in the last d days, per asset.", cat: "Time-series" },
  { name: "ts_min", sig: "ts_min(x, d)", snippet: "ts_min(${1:x}, ${2:252})", doc: "Lowest value of x in the last d days, per asset.", cat: "Time-series" },
  { name: "ts_delta", sig: "ts_delta(x, d)", snippet: "ts_delta(${1:x}, ${2:5})", doc: "x(t) − x(t−d): change over d days.", cat: "Time-series" },
  { name: "ts_delay", sig: "ts_delay(x, d)", snippet: "ts_delay(${1:x}, ${2:1})", doc: "x(t−d): the value d days ago.", cat: "Time-series" },
  { name: "ts_rank", sig: "ts_rank(x, d)", snippet: "ts_rank(${1:x}, ${2:20})", doc: "Rank of today's value within the past d days, per asset.", cat: "Time-series" },
  { name: "ts_corr", sig: "ts_corr(x, y, d)", snippet: "ts_corr(${1:x}, ${2:y}, ${3:20})", doc: "Rolling d-day correlation between x and y, per asset.", cat: "Time-series" },
  { name: "ts_decay_linear", sig: "ts_decay_linear(x, d)", snippet: "ts_decay_linear(${1:x}, ${2:5})", doc: "Linearly weighted moving average; recent days weigh more.", cat: "Time-series" },
  { name: "ts_autocorr", sig: "ts_autocorr(x, lag, window)", snippet: "ts_autocorr(${1:x}, ${2:1}, ${3:20})", doc: "Rolling autocorrelation at a given lag.", cat: "Time-series" },
  { name: "group_rank", sig: "group_rank(x, group)", snippet: "group_rank(${1:x}, ${2:sector})", doc: "Cross-sectional rank within each group.", cat: "Group" },
  { name: "group_zscore", sig: "group_zscore(x, group)", snippet: "group_zscore(${1:x}, ${2:sector})", doc: "Z-score within each group.", cat: "Group" },
  { name: "group_neutralize", sig: "group_neutralize(x, group)", snippet: "group_neutralize(${1:x}, ${2:sector})", doc: "Subtract the group mean, making the alpha sector/industry neutral.", cat: "Group" },
  { name: "log", sig: "log(x)", snippet: "log(${1:x})", doc: "Natural logarithm.", cat: "Element-wise" },
  { name: "abs", sig: "abs(x)", snippet: "abs(${1:x})", doc: "Absolute value.", cat: "Element-wise" },
  { name: "sign", sig: "sign(x)", snippet: "sign(${1:x})", doc: "Sign function: −1, 0 or 1.", cat: "Element-wise" },
  { name: "sqrt", sig: "sqrt(x)", snippet: "sqrt(${1:x})", doc: "Square root of |x|.", cat: "Element-wise" },
  { name: "power", sig: "power(x, n)", snippet: "power(${1:x}, ${2:2})", doc: "x raised to the n-th power.", cat: "Element-wise" },
  { name: "max", sig: "max(x, y)", snippet: "max(${1:x}, ${2:0})", doc: "The larger of x and y, stock by stock. Put the data first: max(returns, 0).", cat: "Element-wise" },
  { name: "min", sig: "min(x, y)", snippet: "min(${1:x}, ${2:0})", doc: "The smaller of x and y, stock by stock. Put the data first: min(returns, 0).", cat: "Element-wise" },
  { name: "clamp", sig: "clamp(x, lo, hi)", snippet: "clamp(${1:x}, ${2:-1}, ${3:1})", doc: "Clip values to the range [lo, hi].", cat: "Element-wise" },
];

export const DSL_FIELDS: DslField[] = [
  { name: "close", doc: "Adjusted closing price" },
  { name: "open", doc: "Opening price" },
  { name: "high", doc: "Daily high" },
  { name: "low", doc: "Daily low" },
  { name: "volume", doc: "Daily trading volume" },
  { name: "returns", doc: "Daily return: close / prev_close − 1" },
  { name: "vwap", doc: "Volume-weighted average price" },
  { name: "cap", doc: "Dollar volume (price × volume). A rough stand-in for size, not true market cap." },
  { name: "sector", doc: "GICS sector code. Use with group_* operators." },
  { name: "log_returns", doc: "ln(close / prev_close). Local engine only; BRAIN calls it log_ret.", localOnly: true },
  { name: "range", doc: "Intraday range: high − low. Local engine only.", localOnly: true },
  { name: "gap", doc: "Overnight gap: open / prev_close − 1. Local engine only.", localOnly: true },
  { name: "volume_ratio", doc: "Volume / 20-day average volume. Local engine only; use adv20 on BRAIN.", localOnly: true },
  { name: "sales", doc: "Revenue over the last 12 months, in dollars. Known from the filing date on. Local engine only; BRAIN uses fnd6_ fields.", localOnly: true },
  { name: "net_income", doc: "Net income over the last 12 months, in dollars. Local engine only.", localOnly: true },
  { name: "operating_income", doc: "Operating income over the last 12 months, in dollars. Banks don't report it. Local engine only.", localOnly: true },
  { name: "cashflow_op", doc: "Operating cash flow over the last 12 months, in dollars. Local engine only.", localOnly: true },
  { name: "equity", doc: "Shareholders' equity (book value) from the latest balance sheet, in dollars. Local engine only.", localOnly: true },
  { name: "assets", doc: "Total assets from the latest balance sheet, in dollars. Local engine only.", localOnly: true },
  { name: "liabilities", doc: "Total liabilities from the latest balance sheet, in dollars. Local engine only.", localOnly: true },
  { name: "shares_out", doc: "Diluted shares outstanding, adjusted for later stock splits. Local engine only.", localOnly: true },
  { name: "mktcap", doc: "Market cap: close × shares_out. Real size, unlike cap. Local engine only.", localOnly: true },
  { name: "book_to_market", doc: "Equity / market cap. High means cheap relative to book value. Local engine only.", localOnly: true },
  { name: "earnings_yield", doc: "Net income / market cap (the inverse of P/E). Local engine only.", localOnly: true },
  { name: "sales_to_price", doc: "Sales / market cap. Local engine only.", localOnly: true },
  { name: "cashflow_yield", doc: "Operating cash flow / market cap. Local engine only.", localOnly: true },
  { name: "roe", doc: "Net income / equity: profit per dollar of book value. Local engine only.", localOnly: true },
  { name: "roa", doc: "Net income / assets. Local engine only.", localOnly: true },
  { name: "op_margin", doc: "Operating income / sales: how much of each sales dollar is operating profit. Local engine only.", localOnly: true },
  { name: "leverage", doc: "Liabilities / assets: how debt-funded the company is. Local engine only.", localOnly: true },
  { name: "adv5", doc: "Average daily volume over the past 5 days (BRAIN)", brainOnly: true },
  { name: "adv10", doc: "Average daily volume over the past 10 days (BRAIN)", brainOnly: true },
  { name: "adv20", doc: "Average daily volume over the past 20 days (BRAIN)", brainOnly: true },
  { name: "adv60", doc: "Average daily volume over the past 60 days (BRAIN)", brainOnly: true },
  { name: "log_ret", doc: "Log return (BRAIN native)", brainOnly: true },
  { name: "shares", doc: "Shares outstanding (BRAIN)", brainOnly: true },
  { name: "industry", doc: "GICS industry code (BRAIN)", brainOnly: true },
  { name: "subindustry", doc: "GICS sub-industry code (BRAIN)", brainOnly: true },
];

export interface DslExample {
  name: string;
  expression: string;
  description: string;
}

/** Mirrors the backend's /api/dsl/operators examples so the UI works even if the API is asleep. */
export const DEFAULT_EXAMPLES: DslExample[] = [
  { name: "Short-Term Reversal", expression: "rank(-ts_delta(close, 5))", description: "Fade the last week's move. Short-term winners tend to give back gains." },
  { name: "Volume-Price Divergence", expression: "rank(ts_corr(returns, volume, 20)) * -1", description: "Short names where price and volume move together." },
  { name: "Vol-Adjusted Reversal", expression: "rank(-ts_mean(returns, 5)) * rank(ts_std(returns, 20))", description: "Reversal scaled by recent volatility." },
  { name: "Sector-Neutral Reversal", expression: "group_neutralize(rank(-returns), sector)", description: "One-day reversal with sector exposure removed." },
  { name: "Decay-Weighted Momentum", expression: "rank(ts_decay_linear(returns, 10)) - rank(ts_std(returns, 20))", description: "Recent momentum minus a volatility penalty." },
  { name: "Volume Breakout", expression: "rank(-ts_corr(close, volume, 10)) + rank(ts_delta(volume, 5))", description: "Price-volume divergence plus a volume surge." },
];

/** [min, max] number of inputs each operator accepts. */
export const ARITY: Record<string, [number, number]> = {
  rank: [1, 1], zscore: [1, 1], demean: [1, 1], winsorize: [1, 2],
  ts_mean: [2, 2], ts_std: [2, 2], ts_sum: [2, 2], ts_max: [2, 2], ts_min: [2, 2],
  ts_delta: [2, 2], ts_delay: [2, 2], ts_rank: [2, 2], ts_corr: [3, 3], ts_decay_linear: [2, 2], ts_autocorr: [1, 3],
  group_rank: [2, 2], group_zscore: [2, 2], group_neutralize: [2, 2],
  log: [1, 1], abs: [1, 1], sign: [1, 1], sqrt: [1, 1], power: [2, 2], clamp: [3, 3], max: [2, 2], min: [2, 2],
};

/** Which input positions must be a plain whole number of days. */
export const WINDOW_ARGS: Record<string, number[]> = {
  ts_mean: [1], ts_std: [1], ts_sum: [1], ts_max: [1], ts_min: [1], ts_delta: [1], ts_delay: [1],
  ts_rank: [1], ts_corr: [2], ts_decay_linear: [1], ts_autocorr: [1, 2],
};

const FN_SET = new Set(DSL_FUNCTIONS.map((f) => f.name));
const FIELD_MAP = new Map(DSL_FIELDS.map((f) => [f.name, f]));
const FN_MAP = new Map(DSL_FUNCTIONS.map((f) => [f.name, f]));

// ── Validation ──────────────────────────────────────────────────────────────

export interface Diagnostic {
  start: number;
  end: number;
  message: string;
  severity: "error" | "warning" | "info";
  /** The expression can't run on the local engine, only on BRAIN */
  needsBrain?: boolean;
}

export function validateExpression(code: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const stack: number[] = [];

  const re = /[A-Za-z_]\w*|[()]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const tok = m[0];
    const start = m.index;
    const end = start + tok.length;

    if (tok === "(") {
      stack.push(start);
      continue;
    }
    if (tok === ")") {
      if (stack.length === 0) out.push({ start, end, message: "Unmatched closing parenthesis", severity: "error" });
      else stack.pop();
      continue;
    }

    // identifier: function call or field?
    let j = end;
    while (j < code.length && code[j] === " ") j++;
    const isCall = code[j] === "(";

    if (isCall) {
      if (!FN_SET.has(tok)) {
        out.push({ start, end, message: `Unknown operator "${tok}"`, severity: "error" });
      }
    } else {
      const f = FIELD_MAP.get(tok);
      if (!f) {
        out.push({ start, end, message: `"${tok}" isn't in the local dataset. If it's a WorldQuant datafield, use the BRAIN button to run it.`, severity: "warning", needsBrain: true });
      } else if (f.brainOnly) {
        out.push({ start, end, message: `"${tok}" exists on WorldQuant BRAIN only. The local backtest can't evaluate it.`, severity: "info", needsBrain: true });
      }
    }
  }
  for (const s of stack) out.push({ start: s, end: s + 1, message: "Unclosed parenthesis", severity: "error" });

  // Structure checks (only when the text parses cleanly)
  try {
    const root = parseExpression(code);
    walk(root, (n) => {
      if (n.t !== "call" || !FN_SET.has(n.fn)) return;
      const [lo, hi] = ARITY[n.fn] ?? [0, 99];
      if (n.args.length < lo || n.args.length > hi) {
        const sig = FN_MAP.get(n.fn)?.sig ?? n.fn;
        const want = lo === hi ? `${lo}` : `${lo} to ${hi}`;
        out.push({ start: n.s, end: n.fnEnd, message: `${n.fn} needs ${want} input${hi === 1 ? "" : "s"}: ${sig}`, severity: "error" });
        return;
      }
      for (const idx of WINDOW_ARGS[n.fn] ?? []) {
        const a = n.args[idx];
        if (a && !(a.t === "num" && Number.isInteger(a.v) && a.v >= 1)) {
          out.push({ start: a.s, end: a.e, message: `The ${idx === 1 || idx === 2 ? "window" : "input"} here must be a whole number of days, like 5 or 20`, severity: "error" });
        }
      }
    });
  } catch {
    /* syntax problems are already reported above */
  }
  return out;
}

// ── Monaco setup ────────────────────────────────────────────────────────────

let registered = false;

export function setupMonaco(monaco: Monaco) {
  if (registered) return;
  registered = true;

  monaco.languages.register({ id: LANG_ID });

  monaco.languages.setMonarchTokensProvider(LANG_ID, {
    functions: DSL_FUNCTIONS.map((f) => f.name),
    groups: ["sector", "industry", "subindustry"],
    fields: DSL_FIELDS.map((f) => f.name).filter((n) => !["sector", "industry", "subindustry"].includes(n)),
    tokenizer: {
      root: [
        [
          /[A-Za-z_]\w*/,
          { cases: { "@functions": "fn", "@groups": "group", "@fields": "field", "@default": "identifier" } },
        ],
        [/\d+(\.\d+)?/, "number"],
        [/[()]/, "paren"],
        [/,/, "comma"],
        [/[-+*/<>=!&|^%?:]+/, "operator"],
        [/\s+/, "white"],
      ],
    },
  } as never);

  monaco.languages.setLanguageConfiguration(LANG_ID, {
    brackets: [["(", ")"]],
    autoClosingPairs: [{ open: "(", close: ")" }],
    surroundingPairs: [{ open: "(", close: ")" }],
  });

  monaco.editor.defineTheme(THEME_ID, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "fn", foreground: "ffb36b", fontStyle: "bold" },
      { token: "field", foreground: "5eead4" },
      { token: "group", foreground: "c4a7ff" },
      { token: "identifier", foreground: "f87171" },
      { token: "number", foreground: "ff8049" },
      { token: "operator", foreground: "a1a1aa" },
      { token: "paren", foreground: "76767f" },
      { token: "comma", foreground: "55555e" },
    ],
    colors: {
      "editor.background": "#0c0c0f",
      "editor.foreground": "#e4e4e7",
      "editorCursor.foreground": "#ff6a3d",
      "editor.selectionBackground": "#ff6a3d38",
      "editor.inactiveSelectionBackground": "#ff6a3d1c",
      "editor.lineHighlightBackground": "#00000000",
      "editor.lineHighlightBorder": "#00000000",
      "editorBracketMatch.background": "#ff6a3d22",
      "editorBracketMatch.border": "#ff6a3d66",
      "editorWidget.background": "#131316",
      "editorWidget.border": "#2a2a31",
      "editorSuggestWidget.background": "#131316",
      "editorSuggestWidget.border": "#2a2a31",
      "editorSuggestWidget.foreground": "#d4d4d8",
      "editorSuggestWidget.selectedBackground": "#ff6a3d22",
      "editorSuggestWidget.highlightForeground": "#ffb36b",
      "editorHoverWidget.background": "#131316",
      "editorHoverWidget.border": "#2a2a31",
      "editorError.foreground": "#ff5470",
      "editorWarning.foreground": "#ffc857",
      "editorInfo.foreground": "#6ea8ff",
      "scrollbarSlider.background": "#ffffff14",
      "focusBorder": "#00000000",
    },
  });

  monaco.languages.registerCompletionItemProvider(LANG_ID, {
    triggerCharacters: ["(", ",", " "],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provideCompletionItems(model: any, position: any) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const K = monaco.languages.CompletionItemKind;
      const fnItems = DSL_FUNCTIONS.map((f) => ({
        label: f.name,
        kind: K.Function,
        detail: f.sig,
        documentation: f.doc,
        insertText: f.snippet,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        sortText: "1" + f.name,
        range,
      }));
      const fieldItems = DSL_FIELDS.map((f) => ({
        label: f.name,
        kind: K.Field,
        detail: f.brainOnly ? "BRAIN field" : f.localOnly ? "local field" : "data field",
        documentation: f.doc,
        insertText: f.name,
        sortText: "2" + f.name,
        range,
      }));
      return { suggestions: [...fnItems, ...fieldItems] };
    },
  });

  monaco.languages.registerHoverProvider(LANG_ID, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provideHover(model: any, position: any) {
      const w = model.getWordAtPosition(position);
      if (!w) return null;
      const range = new monaco.Range(position.lineNumber, w.startColumn, position.lineNumber, w.endColumn);
      const fn = FN_MAP.get(w.word);
      if (fn) {
        return { range, contents: [{ value: "**" + fn.sig + "**  ·  _" + fn.cat + "_" }, { value: fn.doc }] };
      }
      const field = FIELD_MAP.get(w.word);
      if (field) {
        return { range, contents: [{ value: "**" + field.name + "**  ·  _data field_" }, { value: field.doc }] };
      }
      return null;
    },
  });
}

export function applyMarkers(monaco: Monaco, model: ReturnType<Monaco["editor"]["createModel"]>, diags: Diagnostic[]) {
  const sev = monaco.MarkerSeverity;
  monaco.editor.setModelMarkers(
    model,
    "lqdsl",
    diags.map((d) => {
      const a = model.getPositionAt(d.start);
      const b = model.getPositionAt(d.end);
      return {
        startLineNumber: a.lineNumber,
        startColumn: a.column,
        endLineNumber: b.lineNumber,
        endColumn: b.column,
        message: d.message,
        severity: d.severity === "error" ? sev.Error : d.severity === "warning" ? sev.Warning : sev.Info,
      };
    })
  );
}
