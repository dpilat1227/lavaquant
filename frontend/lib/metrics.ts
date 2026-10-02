/** Single source of truth for metric definitions: powers info tooltips and the docs glossary. */
export interface MetricDoc {
  key: string;
  label: string;
  name: string;
  formula: string;
  /** Tailwind text color class for the glossary heading */
  color: string;
  threshold: string;
  short: string;
  long: string;
}

export const METRICS: MetricDoc[] = [
  {
    key: "IC",
    label: "IC",
    name: "Information Coefficient",
    formula: "Spearman( alpha_t , return_t+h )",
    color: "text-sky-400",
    threshold: "> 0.02 is tradeable",
    short: "Rank correlation between your signal and the returns that follow. +1 is perfect foresight, 0 is noise.",
    long: "Each day, rank every asset by your alpha and by its subsequent return, then correlate the two rankings. IC measures whether the signal sorts winners above losers. Real-world alphas live around 0.01 to 0.05; anything much higher usually means look-ahead bias.",
  },
  {
    key: "IC-IR",
    label: "IC-IR",
    name: "IC Information Ratio",
    formula: "mean(IC) / std(IC)",
    color: "text-lava-400",
    threshold: "> 0.5 solid · > 1.0 excellent",
    short: "Consistency of the signal: average IC divided by how much IC varies day to day. Higher means more reliable.",
    long: "IC tells you how good the signal is on average. IC-IR tells you how dependable it is. A signal with modest IC but a very steady IC-IR can beat a flashy one that swings between strong and useless. This is the daily ratio, not annualized.",
  },
  {
    key: "Sharpe",
    label: "Sharpe",
    name: "Sharpe Ratio",
    formula: "( mean(daily return) / std(daily return) ) × √252",
    color: "text-up",
    threshold: "> 1.0 good · > 2.0 excellent",
    short: "Annualized return per unit of volatility on the long-short portfolio. The standard risk-adjusted score.",
    long: "Computed from the daily P&L of a portfolio that goes long the top bucket and short the bottom bucket of your alpha. WorldQuant BRAIN and most quant desks screen on Sharpe first.",
  },
  {
    key: "Sortino",
    label: "Sortino",
    name: "Sortino Ratio",
    formula: "( mean(daily return) / downside deviation ) × √252",
    color: "text-up",
    threshold: "> 1.5 excellent",
    short: "Like Sharpe, but only penalizes losing days. Better for strategies with skewed returns.",
    long: "Sharpe punishes upside volatility the same as downside. Sortino divides by downside deviation only, so a strategy with occasional big wins is not marked down for them.",
  },
  {
    key: "Annual Return",
    label: "Annual return",
    name: "Annualized Return",
    formula: "( NAV_end / NAV_start ) ^ ( 252 / days ) − 1",
    color: "text-amber-400",
    threshold: "Strategy-dependent",
    short: "Compound annual return of the long-short portfolio, before transaction costs.",
    long: "Gross of trading costs and financing. High-turnover alphas can lose most of this to costs, so read it alongside turnover.",
  },
  {
    key: "Max DD",
    label: "Max drawdown",
    name: "Maximum Drawdown",
    formula: "min( NAV_t / running_peak_t − 1 )",
    color: "text-down",
    threshold: "Beyond −20% is hard to live with",
    short: "Worst peak-to-trough loss in the equity curve. The pain an investor would have sat through.",
    long: "The drawdown chart under the equity curve shows the full underwater history. Institutions often cap tolerable drawdown near 15 to 20 percent.",
  },
  {
    key: "Hit Rate",
    label: "Hit rate",
    name: "Hit Rate",
    formula: "days with IC > 0 / total days",
    color: "text-violet-400",
    threshold: "> 50% required",
    short: "Share of days the signal ranked assets in the right direction on net.",
    long: "Above 50% means the signal is right more often than wrong. Pair it with IC: a high hit rate with tiny IC is a weak edge that is easy to trade away.",
  },
  {
    key: "Avg Turnover",
    label: "Avg turnover",
    name: "Average Daily Turnover",
    formula: "mean( Σ |w_t − w_t−1| ) / 2",
    color: "text-gray-300",
    threshold: "Lower is cheaper to trade",
    short: "Fraction of the portfolio replaced each day. High turnover means high trading costs.",
    long: "Every unit of turnover costs spread and impact. WorldQuant's Fitness score divides by turnover (floored at 12.5%) for exactly this reason. Smoothing with ts_decay_linear is the standard way to bring it down.",
  },
  {
    key: "Fitness",
    label: "Fitness",
    name: "WorldQuant Fitness (estimate)",
    formula: "Sharpe × √( |Returns| / max(Turnover, 0.125) )",
    color: "text-lava-400",
    threshold: "> 1.0 to clear BRAIN's bar",
    short: "WorldQuant's composite of Sharpe, returns and turnover. Shown here as a local estimate.",
    long: "BRAIN's official Fitness comes from its own simulation. This estimate applies the published formula to local backtest numbers, so use it as a preview. Submit to BRAIN for the real score.",
  },
  {
    key: "Score",
    label: "lavaquant score",
    name: "lavaquant Score",
    formula: "weighted blend, 0 to 100",
    color: "text-lava-300",
    threshold: "Heuristic, not an industry metric",
    short: "A transparent 0 to 100 summary: Sharpe 30%, IC-IR 25%, IC 15%, hit rate 10%, drawdown 10%, turnover 10%.",
    long: "Each component is scaled so a strong value earns full marks (Sharpe 2.5, IC-IR 1.0, IC 0.04, hit rate 70%, zero drawdown, turnover at or below 15%). It exists to make results comparable at a glance. It is not a WorldQuant, Numerai or academic metric.",
  },
];

export const METRIC_BY_KEY: Record<string, MetricDoc> = Object.fromEntries(METRICS.map((m) => [m.key, m]));
