import { explain } from "./explain";
import { parseExpression, walk } from "./parse";
import type { Node } from "./parse";
import type { CoachExperiment, CoachReply } from "./api";

/**
 * The offline coach. No API, no key, no cost: it reads the expression's structure and the backtest numbers
 * and applies the rules a practitioner would. It can't answer arbitrary questions, but it never makes things up.
 */

export type LocalMode = "explain" | "next" | "review" | "ask";

export interface LocalMetrics {
  sharpe: number;
  ic_mean: number;
  ic_ir: number;
  annual_return: number;
  max_drawdown: number;
  hit_rate: number;
  avg_daily_turnover: number;
  n_trading_days: number;
}

// ── Reading the expression ──────────────────────────────────────────────────

type Tag = "reversal" | "momentum" | "continuation" | "lowvol" | "highvol" | "volume" | "intraday" | "pvcorr" | "level";

interface Shape {
  src: string;
  ast: Node;
  tags: Tag[];
  window: number | null;
  ranked: boolean;
  neutral: boolean;
  smoothed: boolean;
  fields: string[];
  innerOfRank: string | null;
}

const PRICE_SRC = new Set(["close", "open", "vwap"]);

/** Find the first node matching pred, plus whether it sits under an odd number of minus signs. */
function find(n: Node, pred: (n: Node, parent: string | null) => boolean, neg = false, parent: string | null = null): { node: Node; neg: boolean } | null {
  if (pred(n, parent)) return { node: n, neg };
  switch (n.t) {
    case "un":
      return find(n.x, pred, n.op === "-" ? !neg : neg, parent);
    case "bin":
      return find(n.l, pred, neg, parent) ?? find(n.r, pred, n.op === "-" ? !neg : neg, parent);
    case "call":
      for (const a of n.args) {
        const r = find(a, pred, neg, n.fn);
        if (r) return r;
      }
      return null;
    default:
      return null;
  }
}

function windowOf(n: Node): number | null {
  if (n.t === "call" && n.args[1]?.t === "num") return n.args[1].v;
  return null;
}

function shapeOf(src: string): Shape | null {
  let ast: Node;
  try {
    ast = parseExpression(src);
  } catch {
    return null;
  }
  const fields = new Set<string>();
  const fns = new Set<string>();
  walk(ast, (n) => {
    if (n.t === "name") fields.add(n.n);
    if (n.t === "call") fns.add(n.fn);
  });

  const tags: Tag[] = [];
  let window: number | null = null;

  // bare `returns` only counts as a price move when it isn't feeding a volatility / correlation measure
  const PASS = new Set(["rank", "zscore", "demean", "winsorize", "ts_decay_linear", "group_neutralize", "group_rank", "group_zscore"]);
  const isMove = (n: Node, parent: string | null) =>
    (n.t === "name" && (n.n === "returns" || n.n === "log_returns") && (parent === null || PASS.has(parent))) ||
    (n.t === "call" &&
      ["ts_delta", "ts_mean", "ts_sum", "ts_decay_linear"].includes(n.fn) &&
      n.args[0]?.t === "name" &&
      (n.args[0].n === "returns" || n.args[0].n === "log_returns" || (n.fn === "ts_delta" && PRICE_SRC.has(n.args[0].n))));
  const move = find(ast, isMove);
  if (move) {
    window = move.node.t === "call" ? windowOf(move.node) : 1;
    const w = window ?? 1;
    if (move.neg) tags.push("reversal");
    else if (w >= 40) tags.push("momentum");
    else tags.push("continuation");
  }
  if (fns.has("ts_std")) {
    const v = find(ast, (n) => n.t === "call" && n.fn === "ts_std");
    tags.push(v?.neg ? "lowvol" : "highvol");
    window ??= v ? windowOf(v.node) : null;
  }
  if (fns.has("ts_corr")) tags.push("pvcorr");
  if (["volume", "volume_ratio", "cap"].some((f) => fields.has(f))) tags.push("volume");
  if (["open", "high", "low", "gap", "range"].some((f) => fields.has(f)) && !move) tags.push("intraday");
  if ((fns.has("ts_max") || fns.has("ts_min")) && fields.has("close")) tags.push("level");

  const ranked = ast.t === "call" && ast.fn === "rank" && ast.args.length === 1;
  return {
    src,
    ast,
    tags,
    window,
    ranked,
    neutral: Array.from(fns).some((f) => f.startsWith("group_")),
    smoothed: fns.has("ts_decay_linear"),
    fields: Array.from(fields).filter((f) => f !== "sector"),
    innerOfRank: ranked && ast.t === "call" ? src.slice(ast.args[0].s, ast.args[0].e) : null,
  };
}

// ── What each kind of alpha is betting on ───────────────────────────────────

const STORY: Record<Tag, { story: string; breaks: string }> = {
  reversal: {
    story: "It bets on overreaction. When a stock falls sharply, some of the selling is people who need to sell now, not people who know something. Buyers who step in and supply that liquidity get paid as the price drifts back. Winners get the mirror image.",
    breaks: "It breaks when the move was real news. A drop on bad earnings doesn't bounce, it keeps going. It also tends to fail in strong trending markets, and it trades a lot, so costs matter.",
  },
  momentum: {
    story: "It bets on slow information. News gets absorbed gradually, and investors anchor and herd, so stocks that have been rising for months tend to keep rising for a while.",
    breaks: "It breaks at sharp reversals, like a market crash and rebound, when last year's winners are suddenly the most crowded trade. Expect long quiet stretches with a few brutal months.",
  },
  continuation: {
    story: "It bets that a very recent move keeps going. That's unusual: over days to weeks, the usual pattern in stocks is reversal, not continuation.",
    breaks: "Check the direction before you trust it. If this is a short window with no minus sign, the hypothesis runs against the well-documented pattern, so the burden of proof is on you.",
  },
  lowvol: {
    story: "It bets that calm stocks are underpriced relative to their risk. Many investors can't use leverage, so they overpay for exciting high-volatility stocks, which leaves boring ones with better returns per unit of risk.",
    breaks: "It's a defensive bet, so it lags in sharp rallies led by risky stocks. It also quietly loads on sectors that are calm (utilities, staples), so check it against a sector-neutral version.",
  },
  highvol: {
    story: "It bets that volatile stocks outperform. That runs against the low-volatility anomaly, where calm stocks usually do better per unit of risk, so be clear about why you'd expect it here.",
    breaks: "Volatile stocks have fat tails. A few huge moves can dominate the result, so look at whether it works broadly or only through a handful of names.",
  },
  volume: {
    story: "It uses trading activity as a clue about attention or crowding. Unusual volume means someone with a reason is trading. The open question is whether they are informed (price follows) or just crowded (price reverts).",
    breaks: "Volume is mostly noise on its own and scales with company size, so unadjusted volume mostly ranks big stocks. Compare volume to the stock's own history (ts_mean) before ranking.",
  },
  intraday: {
    story: "It uses where the price traded within the day (open, high, low, gap) as a clue about pressure. A close near the low, or a big overnight gap, can mark exhaustion that the next days partially undo.",
    breaks: "These effects are small and fast, so they trade almost the entire book daily. Costs can erase the edge, which is why daily-horizon intraday alphas look better in a backtest than in real trading.",
  },
  pvcorr: {
    story: "It uses the relationship between price and volume. When both rise together, the move may be crowded and fragile; when they diverge, the move may be driven by something else.",
    breaks: "A rolling correlation over a short window is extremely noisy. Try a longer window before trusting it, and remember it says nothing about direction by itself.",
  },
  level: {
    story: "It uses where today's price sits relative to its past range, like the distance from the 52-week high. Investors anchor to those levels, so stocks near highs can keep drifting up.",
    breaks: "It behaves like a momentum signal in disguise, so it shares momentum's crashes. Check whether it adds anything beyond a plain momentum alpha.",
  },
};

function design(s: Shape): string[] {
  const notes: string[] = [];
  if (!s.ranked) notes.push("The score isn't wrapped in rank(), so a few extreme values can dominate it and it can't be blended cleanly with other signals. rank() puts every day's scores on the same -1 to +1 scale.");
  if (!s.neutral) notes.push("It has no sector neutralization, so some of what it earns may just be a bet on sectors rather than stock picking. A group_neutralize(…, sector) version tells you how much.");
  if (!s.smoothed && s.tags.some((t) => t === "reversal" || t === "intraday")) notes.push("Nothing smooths it, so the book will churn daily. ts_decay_linear is the usual fix for that.");
  return notes;
}

// ── Explain ─────────────────────────────────────────────────────────────────

function explainMode(s: Shape): CoachReply {
  const paras: string[] = [];
  if (s.tags.length === 0) {
    paras.push("I can't tell what market idea this is built on, which is itself useful information. A good alpha starts as a sentence: 'stocks that X tend to Y'. If you can't write that sentence for this formula, the backtest can't tell you much.");
    paras.push(`It uses ${s.fields.join(", ") || "no data"}. Try writing the sentence first, then check whether the formula actually says it.`);
  } else {
    const primary = s.tags[0];
    paras.push(STORY[primary].story);
    paras.push(STORY[primary].breaks);
    for (const extra of s.tags.slice(1, 3)) paras.push(`It also leans on ${extra === "lowvol" ? "low volatility" : extra === "highvol" ? "volatility" : extra === "pvcorr" ? "price-volume correlation" : extra}. ${STORY[extra].breaks}`);
  }
  const d = design(s);
  if (d.length) paras.push(d[0]);

  const w = s.window;
  return {
    reply: paras.join("\n\n"),
    experiments: [],
    concept: s.tags[0] === "reversal" ? { term: "Liquidity provision", plain: "Earning a return by taking the other side of someone who needs to trade right now." } : s.tags[0] === "momentum" ? { term: "Underreaction", plain: "Prices adjust to news slowly, so the move continues after the first reaction." } : s.tags[0] === "lowvol" ? { term: "Low-volatility anomaly", plain: "Calm stocks have historically earned as much as wild ones, which is hard to square with 'more risk, more return'." } : null,
    check: w ? `Before you run it: do you expect this to work better in a calm market or a panicking one, and should a ${w}-day window give a higher or lower IC than a longer one? Write your guess down.` : "Before you run it: should the IC come out positive or negative, and roughly how big? Write your guess down.",
    remaining: -1,
  };
}

// ── Next experiments ────────────────────────────────────────────────────────

function ranked(s: Shape): string {
  return s.ranked ? s.src : `rank(${s.src})`;
}

function nextMode(s: Shape, m: LocalMetrics | null): CoachReply {
  const out: { priority: number; x: CoachExperiment }[] = [];
  const tun = explain(s.src).tunables[0];
  const turnover = m?.avg_daily_turnover ?? null;
  const losing = m ? m.sharpe < 0 : false;
  const reversalish = s.tags.includes("reversal") || s.tags.includes("intraday");

  if (losing) {
    const flip = (code: string, node: Node) => (node.t === "un" && node.op === "-" ? code.slice(node.x.s, node.x.e) : `-(${code})`);
    const arg = s.ast.t === "call" && s.ranked ? s.ast.args[0] : null;
    const flipped = arg && s.innerOfRank ? `rank(${flip(s.src, arg)})` : `-(${s.src})`;
    out.push({
      priority: 0,
      x: {
        title: "Flip the sign as a control",
        expression: flipped,
        why: "Your result is negative, so the idea may point the other way. This isn't something to ship. It's a control experiment: if the flipped version is the one that works, your hypothesis had the wrong direction, and that tells you what the market is actually doing.",
        predict: "Roughly the mirror image of your current result, minus costs. If it isn't, the signal is probably noise.",
      },
    });
  }

  if (tun) {
    const alt = tun.options.find((o) => o > tun.value) ?? [...tun.options].reverse().find((o) => o < tun.value);
    if (alt !== undefined && alt !== tun.value) {
      const expression = s.src.slice(0, tun.start) + String(alt) + s.src.slice(tun.end);
      const longer = alt > tun.value;
      out.push({
        priority: 2,
        x: {
          title: `Try a ${alt}-day window`,
          expression,
          why: `The ${tun.value}-day window in ${tun.where} is a guess about how fast the effect plays out. A ${longer ? "longer" : "shorter"} window ${longer ? "smooths out noise and trades less, but reacts slower" : "reacts faster and often scores a higher IC, but trades more"}.`,
          predict: longer ? "Lower turnover. IC may drop a little if the effect is short-lived." : "Higher turnover. IC may rise if the effect is fast.",
        },
      });
    }
  }

  if (!s.smoothed) {
    const smoothed = s.ranked && s.innerOfRank ? `rank(ts_decay_linear(${s.innerOfRank}, 5))` : `ts_decay_linear(${s.src}, 5)`;
    out.push({
      priority: (turnover !== null && turnover > 0.5) || reversalish ? 1 : 3,
      x: {
        title: "Smooth it to trade less",
        expression: smoothed,
        why: turnover !== null && turnover > 0.5 ? `Your book turns over ${(turnover * 100).toFixed(0)}% a day. That's expensive to trade for real. Averaging the signal over recent days (recent weighted more) makes the positions change more slowly.` : "Fast signals change their picks every day. Averaging over a few days (recent weighted more) keeps most of the signal and cuts how much you trade, which is where real-world costs come from.",
        predict: "Turnover falls noticeably. IC and Sharpe dip slightly. The question is whether they dip less than the turnover does.",
      },
    });
  }

  if (!s.neutral) {
    out.push({
      priority: 2,
      x: {
        title: "Strip out the sector bets",
        expression: s.ranked ? `group_neutralize(${s.src}, sector)` : `group_neutralize(rank(${s.src}), sector)`,
        why: "If your alpha secretly loads on a few sectors, part of the result is a sector call, not stock picking. Neutralizing keeps only the within-sector differences.",
        predict: "Similar IC if the idea is real stock-level information. A big drop means sector exposure was doing the work.",
      },
    });
  } else if (!s.ranked) {
    out.push({
      priority: 3,
      x: { title: "Rank it", expression: `rank(${s.src})`, why: "Ranking caps the influence of extreme values and gives a fixed scale, which is what makes signals blendable.", predict: "More stable results. Often a small IC gain when the raw values have fat tails." },
    });
  }

  if (!s.fields.includes("returns") || !s.tags.includes("lowvol")) {
    if (!s.src.includes("ts_std")) {
      out.push({
        priority: 4,
        x: {
          title: "Blend in a second, different idea",
          expression: `${ranked(s)} + rank(-ts_std(returns, 20))`,
          why: "Two signals that are only weakly related make each other's mistakes cancel. Low volatility is a classic partner because it has little to do with price direction. Rank both first so they share a scale.",
          predict: "A smoother equity curve and a better IC-IR than either alone. If not, they were more related than you thought.",
        },
      });
    }
  }

  out.sort((a, b) => a.priority - b.priority);
  const seen = new Set([s.src]);
  const picked: CoachExperiment[] = [];
  for (const { x } of out) {
    if (seen.has(x.expression) || !explain(x.expression).ok) continue;
    seen.add(x.expression);
    picked.push(x);
    if (picked.length === 3) break;
  }

  const lead = m
    ? "Change one thing at a time, so that if the result moves you know why. Here are the three I'd run, most informative first."
    : "Run it once first so you have a baseline to compare against. Then change one thing at a time. These are the three I'd try, most informative first.";
  return {
    reply: `${lead}\n\nFor each, write down what you expect before you run it. If you're wrong, that's the useful part: your mental model needs updating.`,
    experiments: picked,
    concept: { term: "One variable at a time", plain: "If you change two things and the result improves, you don't know which one helped, and you can't repeat it." },
    check: null,
    remaining: -1,
  };
}

// ── Review ──────────────────────────────────────────────────────────────────

function reviewMode(s: Shape, m: LocalMetrics): CoachReply {
  const paras: string[] = [];
  const years = Math.max(m.n_trading_days / 252, 0.5);
  const se = Math.sqrt((1 + 0.5 * m.sharpe ** 2) / years);
  const z = m.sharpe / se;

  // signal strength
  if (m.ic_ir < -0.02 || m.sharpe < -0.1) {
    paras.push(`The result is negative (Sharpe ${m.sharpe.toFixed(2)}, IC-IR ${m.ic_ir.toFixed(3)}). The score is ranking stocks in the wrong order. Either the direction of your idea is backwards, or there's no signal. Flip the sign as a control experiment to find out which.`);
  } else if (m.ic_ir < 0.03) {
    paras.push(`IC-IR is ${m.ic_ir.toFixed(3)}, which is close to zero. The score has little consistent relationship with what happens next. That's the most common outcome, and it's not a failure of effort. Most ideas don't work.`);
  } else if (m.ic_ir < 0.1) {
    paras.push(`IC-IR is ${m.ic_ir.toFixed(3)}. That's weak but in the range real alphas live in (about 0.05 to 0.15 per day). The signal is small, and small signals only pay if you can trade them cheaply.`);
  } else if (m.ic_ir <= 0.2) {
    paras.push(`IC-IR is ${m.ic_ir.toFixed(3)}, which is solid for a daily signal. The next question is whether it survives a period the alpha never saw.`);
  } else {
    paras.push(`IC-IR is ${m.ic_ir.toFixed(3)}, which is unusually high for a daily signal. Be suspicious before you celebrate. Check for lookahead (using information that wasn't known yet) and for overfitting from tuning on this exact period.`);
  }

  // noise
  paras.push(`Noise matters here. With about ${years.toFixed(1)} years of data, the uncertainty on a Sharpe ratio is roughly ±${se.toFixed(2)}. Your Sharpe of ${m.sharpe.toFixed(2)} is ${Math.abs(z).toFixed(1)} standard errors from zero${Math.abs(z) < 2 ? ", which is within what luck can produce. You can't distinguish it from chance yet." : ", which is beyond what a single lucky draw usually gives, though trying many ideas and keeping the best inflates this."}`);

  // disagreement between metrics
  if (m.sharpe > 0.5 && m.ic_ir < 0.04) {
    paras.push("Sharpe looks fine but IC-IR is low. That mix usually means the profit comes from the extremes (the very top and bottom picks) rather than from a consistent ranking of the whole universe. Check the quintile chart: is it a staircase, or just Q1 and Q5?");
  } else if (m.ic_ir >= 0.06 && m.sharpe < 0.3) {
    paras.push("IC-IR is respectable but Sharpe is weak. The ranking is informative but the long and short books aren't capturing it, often because the signal is spread evenly through the middle while the engine only trades the top and bottom 20%.");
  }

  // turnover
  const t = m.avg_daily_turnover;
  if (t > 1) {
    paras.push(`Turnover is ${(t * 100).toFixed(0)}% a day, so the whole book is traded more than once a day. These are gross returns with no trading costs, so the real number would be a lot lower. Smoothing with ts_decay_linear is the first thing to try.`);
  } else if (t > 0.4) {
    paras.push(`Turnover is ${(t * 100).toFixed(0)}% a day. That's high enough that realistic costs will eat a meaningful share of the return.`);
  } else {
    paras.push(`Turnover is ${(t * 100).toFixed(0)}% a day, which is cheap enough that costs probably don't decide the outcome.`);
  }

  // drawdown
  if (m.annual_return > 0 && Math.abs(m.max_drawdown) > m.annual_return * 1.5) {
    paras.push(`The worst drawdown (${(m.max_drawdown * 100).toFixed(0)}%) is larger than a year and a half of returns. Look at when it happened: if it's one episode, the alpha may be regime-dependent.`);
  }

  const worst = m.ic_ir < 0.03 ? "Write down why the idea should work in one sentence, then change only the direction or the window and see whether anything moves." : t > 0.4 ? "Run the smoothed version and compare turnover against Sharpe." : "Test it on a different time period (set the dates to a window you didn't tune on) and see if the Sharpe holds.";

  return {
    reply: paras.join("\n\n"),
    experiments: [],
    concept: { term: "Standard error of a Sharpe ratio", plain: "About √((1 + SR²/2) / years). A few years of data gives a Sharpe a wide margin of error, so small differences between alphas are usually noise." },
    check: `Your next step: ${worst}`,
    remaining: -1,
  };
}

// ── Questions: a small hand-written FAQ ─────────────────────────────────────

const FAQ: { match: RegExp; term: string; answer: string }[] = [
  { match: /\brank\b|why rank|ranking/i, term: "rank()", answer: "rank() replaces each stock's value with its position among all stocks that day, scaled to -1 (lowest) to +1 (highest). It does two things: it throws away the size of extreme values so one outlier can't dominate, and it puts every signal on the same scale so you can add them together. You lose how much bigger one value is than another, which is usually fine." },
  { match: /neutral|sector/i, term: "Neutralization", answer: "group_neutralize(x, sector) subtracts each sector's average from its stocks. After that, the score says 'better than the other stocks in my sector', not 'in a hot sector'. Use it when you want to test stock picking rather than sector calls. A big drop in performance after neutralizing means your alpha was mostly a sector bet." },
  { match: /turnover|trade.*cost|cost/i, term: "Turnover", answer: "Turnover is how much of the portfolio you trade each day. Every trade costs money (spread, fees, price impact), and this backtest ignores that. A signal with 5% IC-IR and 30% turnover can survive costs; the same signal at 150% turnover usually can't. Smoothing with ts_decay_linear lowers it." },
  { match: /\bic\b|information coefficient|ic-?ir/i, term: "IC and IC-IR", answer: "IC is each day's rank correlation between your scores and what the stocks did next. It's a tiny number, 0.02 is decent. IC-IR is the average IC divided by how much it bounces day to day, so it rewards a signal that works consistently, not one that works hugely on a few days. About 0.05 to 0.15 is realistic; much higher usually means a mistake." },
  { match: /sharpe/i, term: "Sharpe ratio", answer: "Annual return divided by annual volatility of the long-short portfolio. It's return per unit of risk. Over a few years of data it's very noisy: a Sharpe of 0.5 is often indistinguishable from luck. The IC is a steadier thing to look at when you're comparing ideas." },
  { match: /decay|smooth/i, term: "ts_decay_linear", answer: "ts_decay_linear(x, d) is a d-day weighted average where yesterday counts more than the day before, and so on. It makes the signal change slowly, which cuts turnover. The cost is that it reacts more slowly to new information." },
  { match: /window|how many days|lookback|look back/i, term: "Choosing a window", answer: "A window is your guess about how long the effect lasts. Short (1 to 5 days) reacts quickly and trades a lot. Long (60 to 252) is slow and cheap. Pick it from the story, not the backtest: reversal is a days-to-weeks effect, momentum is months, volatility needs a month or more to measure. Then check nearby windows give similar results. If only one exact number works, it's overfit." },
  { match: /overfit|curve.?fit|too good|data.?min/i, term: "Overfitting", answer: "Try enough variations and some will look great by luck. Defenses: write the hypothesis before running; limit how many variants you try; keep a later period that you never tune on; and prefer ideas with an economic story. If a result needs one exact parameter to work, treat it as noise." },
  { match: /momentum/i, term: "Momentum", answer: "Stocks that rose over the past 3 to 12 months tend to keep rising for a while. The usual form skips the most recent month, because the very latest month tends to reverse: ts_delay(close, 21) / ts_delay(close, 252) - 1. It's a slow signal with big, occasional crashes." },
  { match: /revers|mean.?revert/i, term: "Reversal", answer: "Stocks that fell over the past day to month tend to bounce, and winners give some back. Write it as rank(-ts_delta(close, 5)): the minus sign flips it so losers score high. It's fast, so it trades a lot, and it works best when you sector-neutralize." },
  { match: /volume/i, term: "Using volume", answer: "Raw volume mostly ranks big stocks, because big stocks trade more. Compare each stock to its own normal: volume / ts_mean(volume, 60), or the built-in volume_ratio. High means unusual attention. Whether attention leads to a rise or a fade is what you're testing." },
  { match: /minus|negative|flip|\bsign\b/i, term: "The minus sign", answer: "A leading minus flips the bet. A high score means buy, so -x buys the stocks where x is low. That's the entire difference between a momentum alpha and a reversal alpha built on the same measurement." },
  { match: /log\b/i, term: "log()", answer: "log() compresses large values and spreads out small ones. It's useful for skewed data like volume, where a few huge values would otherwise dominate. After a log, equal ratios become equal differences." },
  { match: /start|begin|first|where|how.*(build|write|make).*alpha|idea/i, term: "Where to begin", answer: "Start from a sentence, not a formula: 'stocks that did X tend to do Y next'. Then ask what number measures X, wrap it in rank(), choose the sign so high means buy, and run it. The Build one tab in Learn walks you through exactly that. Expect most first attempts to be near zero. That's normal." },
];

function askMode(q: string): CoachReply {
  const hit = FAQ.find((f) => f.match.test(q));
  if (hit) {
    return { reply: hit.answer, experiments: [], concept: null, check: null, remaining: -1 };
  }
  return {
    reply:
      "I'm the offline coach, so I can only answer a fixed set of questions. Try asking about: rank, neutralization, turnover, IC, Sharpe, decay, window size, overfitting, momentum, reversal, volume, or where to begin.\n\nThe Cheat sheet in Learn covers every operator, and the AI coach can handle open-ended questions once it's switched on.",
    experiments: [],
    concept: null,
    check: null,
    remaining: -1,
  };
}

// ── Entry ───────────────────────────────────────────────────────────────────

export function localCoach(mode: LocalMode, expression: string, question: string, metrics: LocalMetrics | null): CoachReply {
  if (mode === "ask") return askMode(question);
  const s = shapeOf(expression.trim());
  if (!s) {
    return { reply: "I can't read this expression yet. Fix the syntax error first, then I can say something useful about it.", experiments: [], concept: null, check: null, remaining: -1 };
  }
  if (mode === "explain") return explainMode(s);
  if (mode === "next") return nextMode(s, metrics);
  if (!metrics) return { reply: "Run a backtest on this expression first, then I can help you read it.", experiments: [], concept: null, check: null, remaining: -1 };
  return reviewMode(s, metrics);
}
