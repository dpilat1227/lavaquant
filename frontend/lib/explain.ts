import { ARITY, DSL_FIELDS, DSL_FUNCTIONS, WINDOW_ARGS } from "./dsl";
import { parseExpression, ParseError, type Node } from "./parse";

export type StepKind = "time" | "cross" | "group" | "math";

export interface Step {
  n: number;
  code: string;
  kind: StepKind;
  /** Plain English. `[[3]]` marks a reference to step 3. */
  text: string;
}

export interface Tunable {
  /** The call the number lives in, e.g. ts_delta(close, 5) */
  where: string;
  value: number;
  /** Position of the number in the source, so it can be swapped in place */
  start: number;
  end: number;
  label: string;
  options: number[];
}

export interface Explanation {
  ok: boolean;
  error?: string;
  /** Raw data the expression reads */
  uses: { name: string; phrase: string }[];
  steps: Step[];
  /** Step number that produces the final score (0 if the expression is just a field) */
  finalStep: number;
  tunables: Tunable[];
  tips: string[];
}

export const KIND_LABEL: Record<StepKind, string> = {
  time: "per stock, over time",
  cross: "across stocks, each day",
  group: "within each sector",
  math: "math",
};

const FIELD_PHRASE: Record<string, string> = {
  close: "the closing price",
  open: "the opening price",
  high: "the day's high",
  low: "the day's low",
  volume: "the number of shares traded",
  returns: "the daily return",
  log_returns: "the daily log return",
  vwap: "the day's average trade price",
  cap: "dollar volume (price × volume)",
  sector: "the sector",
  gap: "the overnight gap (today's open vs yesterday's close)",
  range: "the day's high-to-low range",
  volume_ratio: "volume relative to its 20-day average",
  adv5: "5-day average dollar volume",
  adv10: "10-day average dollar volume",
  adv20: "20-day average dollar volume",
  adv60: "60-day average dollar volume",
  log_ret: "the daily log return",
  shares: "shares outstanding",
  industry: "the industry",
  subindustry: "the sub-industry",
  sales: "sales over the last 12 months",
  net_income: "net income over the last 12 months",
  operating_income: "operating income over the last 12 months",
  cashflow_op: "operating cash flow over the last 12 months",
  equity: "book value (shareholders' equity)",
  assets: "total assets",
  liabilities: "total liabilities",
  shares_out: "shares outstanding",
  mktcap: "market cap",
  book_to_market: "book value relative to market cap",
  earnings_yield: "earnings relative to market cap",
  sales_to_price: "sales relative to market cap",
  cashflow_yield: "cash flow relative to market cap",
  roe: "return on equity",
  roa: "return on assets",
  op_margin: "operating margin",
  leverage: "liabilities relative to assets",
};

const FIELD_NAMES = new Set(DSL_FIELDS.map((f) => f.name));
const FN_NAMES = new Set(DSL_FUNCTIONS.map((f) => f.name));

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(+v.toFixed(4)));

function kindOf(n: Node): StepKind {
  if (n.t === "call") {
    if (n.fn.startsWith("ts_")) return "time";
    if (n.fn.startsWith("group_")) return "group";
    if (["rank", "zscore", "demean", "winsorize"].includes(n.fn)) return "cross";
  }
  return "math";
}

type Unit = "price" | "volume" | "ratio" | "scaled" | "log" | null;

const PRICE = new Set(["close", "open", "high", "low", "vwap"]);
const VOLUME = new Set(["volume", "cap", "adv5", "adv10", "adv20", "adv60", "shares", "shares_out"]);
const RATIO = new Set(["returns", "log_returns", "gap", "range", "volume_ratio", "log_ret", "book_to_market", "earnings_yield", "sales_to_price", "cashflow_yield", "roe", "roa", "op_margin", "leverage"]);
const SCALED_FNS = new Set(["rank", "zscore", "group_rank", "group_zscore", "ts_rank", "sign", "ts_corr", "ts_autocorr"]);
const PASS_FNS = new Set(["ts_mean", "ts_std", "ts_sum", "ts_max", "ts_min", "ts_delta", "ts_delay", "ts_decay_linear", "winsorize", "demean", "group_neutralize", "abs", "sqrt", "clamp", "max", "min", "power"]);

/** What a part of the expression measures, so we can warn when unlike things are added together. */
function unitOf(n: Node, onMismatch: () => void): Unit {
  if (n.t === "num") return null;
  if (n.t === "name") return PRICE.has(n.n) ? "price" : VOLUME.has(n.n) ? "volume" : RATIO.has(n.n) ? "ratio" : null;
  if (n.t === "un") return unitOf(n.x, onMismatch);
  if (n.t === "bin") {
    const l = unitOf(n.l, onMismatch);
    const r = unitOf(n.r, onMismatch);
    if (n.op === "+" || n.op === "-") {
      if (l && r && l !== r) onMismatch();
      return l ?? r;
    }
    if (n.op === "/") return l && r ? "ratio" : l ?? r;
    if (n.op === "*") return l && r ? null : l ?? r;
    return l ?? r;
  }
  const first = n.args.map((a) => unitOf(a, onMismatch));
  if (n.fn === "log") return "log";
  if (SCALED_FNS.has(n.fn)) return "scaled";
  if (n.fn === "ts_std") return first[0] === "price" ? "price" : "ratio";
  if (PASS_FNS.has(n.fn)) return first[0] ?? null;
  return null;
}

function nearestOptions(v: number): number[] {
  const pool = [2, 3, 5, 10, 21, 42, 63, 126, 252].filter((x) => x !== v);
  return pool.sort((a, b) => Math.abs(Math.log(a / v)) - Math.abs(Math.log(b / v))).slice(0, 3).sort((a, b) => a - b);
}

function build(n: Node, r: string[]): string {
  if (n.t === "un") {
    return n.op === "-"
      ? `Flips the sign of ${r[0]}. What used to score high now scores low, so this bets the opposite way.`
      : `Leaves ${r[0]} unchanged.`;
  }
  if (n.t === "bin") {
    const [l, rt] = r;
    switch (n.op) {
      case "+":
        return n.r.t === "num" ? `Adds the constant ${rt} to ${l}.` : n.l.t === "num" ? `Adds the constant ${l} to ${rt}.` : `Adds ${l} and ${rt} together, stock by stock. The two should be on a similar scale (rank each first) or the bigger one will dominate.`;
      case "-":
        return n.r.t === "num" ? `Subtracts ${rt} from ${l}.` : `Subtracts ${rt} from ${l}, stock by stock.`;
      case "*":
        return `Multiplies ${l} by ${rt}. The result is large only where both are large (or both are negative).`;
      case "/":
        return `Divides ${l} by ${rt}, which gives a ratio. Watch for a divisor near zero.`;
      case "**":
        return `Raises ${l} to the power ${rt}.`;
      default:
        return `Takes the remainder of ${l} divided by ${rt}.`;
    }
  }
  if (n.t !== "call") return "";
  const [a, b, c] = r;
  switch (n.fn) {
    case "rank":
      return `Each day, ranks every stock by ${a}: -1 for the lowest, +1 for the highest. Puts different signals on one scale.`;
    case "zscore":
      return `Each day, rescales ${a} across stocks so the average is 0 and a typical spread is 1.`;
    case "demean":
      return `Each day, subtracts the average across stocks from ${a}, so the scores add up to about zero.`;
    case "winsorize":
      return `Each day, clips the most extreme ${n.args[1]?.t === "num" ? fmt((n.args[1] as { v: number }).v * 100) : "5"}% at each end of ${a}, so outliers can't dominate.`;
    case "ts_mean":
      return `For each stock separately, the average of ${a} over the last ${b} days.`;
    case "ts_std":
      return `For each stock, how much ${a} has bounced around over the last ${b} days (standard deviation). Higher means jumpier.`;
    case "ts_sum":
      return `For each stock, the total of ${a} over the last ${b} days.`;
    case "ts_max":
      return `For each stock, the highest value of ${a} in the last ${b} days.`;
    case "ts_min":
      return `For each stock, the lowest value of ${a} in the last ${b} days.`;
    case "ts_delta":
      return `For each stock, how much ${a} changed over ${b} days: today's value minus the value ${b} days ago. Positive means it rose.`;
    case "ts_delay":
      return `For each stock, the value of ${a} from ${b} days ago.`;
    case "ts_rank":
      return `For each stock, where today's ${a} sits within its own last ${b} days: +1 if it's the highest, -1 if the lowest.`;
    case "ts_corr":
      return `For each stock, how closely ${a} and ${b} have moved together over the last ${c} days (+1 in step, -1 opposite).`;
    case "ts_decay_linear":
      return `For each stock, a ${b}-day average of ${a} where recent days count more than older ones. Smooths the signal so you trade less.`;
    case "ts_autocorr":
      return `For each stock, whether ${a} tends to repeat (positive) or reverse (negative) from one ${b ?? "1"}-day step to the next, measured over ${c ?? "20"} days.`;
    case "group_rank":
      return `Each day, ranks stocks by ${a} against only the others in the same ${b} (-1 to +1 within each group).`;
    case "group_zscore":
      return `Each day, z-scores ${a} within each ${b}, so groups with naturally higher values don't win automatically.`;
    case "group_neutralize":
      return `Each day, subtracts the ${b} average of ${a}, so every ${b} averages zero. This removes sector bets and leaves stock-picking.`;
    case "log":
      return `The natural log of ${a}. Shrinks big values, handy for skewed data like volume.`;
    case "abs":
      return `Drops the sign of ${a}, keeping only its size.`;
    case "sign":
      return `Turns ${a} into +1, -1 or 0: just its direction.`;
    case "sqrt":
      return `The square root of the size of ${a}. Dampens big values.`;
    case "power":
      return `Raises ${a} to the power ${b}.`;
    case "clamp":
      return `Limits ${a} to between ${b} and ${c}.`;
    case "max":
      return `The larger of ${a} and ${b}, stock by stock.`;
    case "min":
      return `The smaller of ${a} and ${b}, stock by stock.`;
    default:
      return "";
  }
}

export function explain(src: string): Explanation {
  const empty: Explanation = { ok: false, uses: [], steps: [], finalStep: 0, tunables: [], tips: [] };
  let root: Node;
  try {
    root = parseExpression(src);
  } catch (e) {
    return { ...empty, error: e instanceof ParseError ? e.message : "I couldn't read that expression" };
  }

  const steps: Step[] = [];
  const byCode = new Map<string, number>();
  const uses = new Map<string, string>();
  const tunables: Tunable[] = [];
  let error: string | undefined;

  const fail = (m: string) => {
    if (!error) error = m;
  };

  function visit(n: Node): string {
    if (n.t === "num") return fmt(n.v);
    if (n.t === "name") {
      if (!FIELD_NAMES.has(n.n)) {
        fail(`I don't recognise "${n.n}". Fields you can use: close, open, high, low, volume, returns, vwap, gap, range, volume_ratio, cap, sector.`);
        return n.n;
      }
      const ph = FIELD_PHRASE[n.n] ?? n.n;
      uses.set(n.n, ph);
      return ph;
    }

    if (n.t === "call") {
      if (!FN_NAMES.has(n.fn)) {
        fail(`I don't recognise the operator "${n.fn}". Open the cheat sheet to see all of them.`);
        return n.fn;
      }
      const [lo, hi] = ARITY[n.fn] ?? [0, 99];
      if (n.args.length < lo || n.args.length > hi) {
        const sig = DSL_FUNCTIONS.find((f) => f.name === n.fn)?.sig ?? n.fn;
        fail(`${n.fn} needs ${lo === hi ? lo : `${lo} to ${hi}`} input${hi === 1 ? "" : "s"}, like ${sig}.`);
      }
      for (const idx of WINDOW_ARGS[n.fn] ?? []) {
        const a = n.args[idx];
        if (a && a.t !== "num") fail(`The window in ${n.fn} must be a whole number of days, like 5 or 20.`);
        if (a && a.t === "num") {
          if (tunables.length < 3) {
            tunables.push({
              where: src.slice(n.s, n.e).trim(),
              value: a.v,
              start: a.s,
              end: a.e,
              label: "a window in trading days (5 is about a week, 21 a month, 63 a quarter, 252 a year)",
              options: nearestOptions(a.v),
            });
          }
        }
      }
    }

    const kids: Node[] = n.t === "call" ? n.args : n.t === "bin" ? [n.l, n.r] : [n.x];
    const refs = kids.map(visit);
    const code = src.slice(n.s, n.e).trim();
    const seen = byCode.get(code);
    if (seen) return `[[${seen}]]`;

    // Group operators take a group name as the second input: describe it by its bare name.
    if (n.t === "call" && n.fn.startsWith("group_") && n.args[1]?.t === "name") refs[1] = (n.args[1] as { n: string }).n;

    const step: Step = { n: steps.length + 1, code, kind: kindOf(n), text: build(n, refs.map((x) => x)) };
    steps.push(step);
    byCode.set(code, step.n);
    return `[[${step.n}]]`;
  }

  if (root.t === "num") return { ...empty, error: "That's just a number. An alpha needs data in it, like close or returns." };
  visit(root);
  if (error) return { ...empty, error };

  const tips: string[] = [];
  let mixed = false;
  unitOf(root, () => {
    mixed = true;
  });
  if (mixed) tips.push("You're adding or subtracting two parts that may be on very different scales (price versus volume, say). Wrap each part in rank() first so neither one dominates.");
  if (root.t === "call" && !["rank", "zscore", "group_rank", "group_zscore", "group_neutralize", "demean"].includes(root.fn) && steps.length > 0) {
    tips.push("Ranking at the end is optional for one signal, because the engine already ranks stocks itself. It matters once you blend signals.");
  }

  return {
    ok: true,
    uses: Array.from(uses, ([name, phrase]) => ({ name, phrase })),
    steps,
    finalStep: steps.length,
    tunables,
    tips,
  };
}
