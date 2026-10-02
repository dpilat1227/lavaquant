/**
 * Reference data for the operator/feature documentation panel.
 * Modeled after professional API docs, not tutorials.
 */

export interface PaperRef {
  key: string;        // e.g. "JT93"
  authors: string;
  title: string;
  journal: string;
  year: number;
  url: string;
}

export interface OperatorDoc {
  name: string;
  signature: string;
  category: "cross_sectional" | "time_series" | "group" | "element_wise";
  formula: string;        // LaTeX-style plain text
  description: string;
  intuition: string;
  papers: string[];       // PaperRef keys
  examples: string[];
}

export interface FeatureDoc {
  name: string;
  category: string;
  formula: string;
  description: string;
  intuition: string;
  papers: string[];
}

// ── Papers ────────────────────────────────────────────────────────────────

export const PAPERS: Record<string, PaperRef> = {
  JT93: {
    key: "JT93",
    authors: "Jegadeesh & Titman",
    title: "Returns to Buying Winners and Selling Losers: Implications for Stock Market Efficiency",
    journal: "Journal of Finance",
    year: 1993,
    url: "https://www.jstor.org/stable/2328882",
  },
  FF92: {
    key: "FF92",
    authors: "Fama & French",
    title: "The Cross-Section of Expected Stock Returns",
    journal: "Journal of Finance",
    year: 1992,
    url: "https://www.jstor.org/stable/2329112",
  },
  FF93: {
    key: "FF93",
    authors: "Fama & French",
    title: "Common Risk Factors in the Returns on Stocks and Bonds",
    journal: "Journal of Financial Economics",
    year: 1993,
    url: "https://www.sciencedirect.com/science/article/pii/0304405X93900235",
  },
  NM13: {
    key: "NM13",
    authors: "Novy-Marx",
    title: "The Other Side of Value: The Gross Profitability Premium",
    journal: "Journal of Financial Economics",
    year: 2013,
    url: "https://doi.org/10.1016/j.jfineco.2013.01.003",
  },
  CHORDIA01: {
    key: "CHORDIA01",
    authors: "Chordia, Roll & Subrahmanyam",
    title: "Market Liquidity and Trading Activity",
    journal: "Journal of Finance",
    year: 2001,
    url: "https://doi.org/10.1111/0022-1082.00335",
  },
  ANG06: {
    key: "ANG06",
    authors: "Ang, Hodrick, Xing & Zhang",
    title: "The Cross-Section of Volatility and Expected Returns",
    journal: "Journal of Finance",
    year: 2006,
    url: "https://doi.org/10.1111/j.1540-6261.2006.00836.x",
  },
  LEHMANN90: {
    key: "LEHMANN90",
    authors: "Lehmann",
    title: "Fads, Martingales, and Market Efficiency",
    journal: "Quarterly Journal of Economics",
    year: 1990,
    url: "https://doi.org/10.2307/2937816",
  },
  BLITZ11: {
    key: "BLITZ11",
    authors: "Blitz & Van Vliet",
    title: "The Volatility Effect: Lower Risk Without Lower Return",
    journal: "Journal of Portfolio Management",
    year: 2007,
    url: "https://doi.org/10.3905/jpm.2007.698039",
  },
  MOSKOWITZ12: {
    key: "MOSKOWITZ12",
    authors: "Moskowitz, Ooi & Pedersen",
    title: "Time Series Momentum",
    journal: "Journal of Financial Economics",
    year: 2012,
    url: "https://doi.org/10.1016/j.jfineco.2011.11.003",
  },
  GRINOLD99: {
    key: "GRINOLD99",
    authors: "Grinold & Kahn",
    title: "Active Portfolio Management (2nd ed.)",
    journal: "McGraw-Hill",
    year: 1999,
    url: "https://www.amazon.com/Active-Portfolio-Management-Quantitative-Controlling/dp/0070248826",
  },
};

// ── Operator Docs ─────────────────────────────────────────────────────────

export const OPERATOR_DOCS: OperatorDoc[] = [
  // Cross-sectional
  {
    name: "rank",
    signature: "rank(x)",
    category: "cross_sectional",
    formula: "2 × (rank_i / N) − 1  ∈ [−1, 1]",
    description: "Cross-sectional percentile rank of each asset at each date, scaled to [−1, 1].",
    intuition: "Transforms any raw signal into a uniform distribution across the universe, eliminating outliers and making signals comparable across time. The workhorse of WorldQuant alpha construction — nearly every alpha ends with rank().",
    papers: ["GRINOLD99"],
    examples: ["rank(close)", "rank(-volume)"],
  },
  {
    name: "zscore",
    signature: "zscore(x)",
    category: "cross_sectional",
    formula: "(x − μ_cross) / σ_cross",
    description: "Cross-sectional z-score at each date.",
    intuition: "Similar to rank() but preserves the shape of the distribution. Outliers have more influence than with rank(). Preferred when the raw signal is already approximately normal.",
    papers: ["GRINOLD99"],
    examples: ["zscore(returns)", "zscore(volume)"],
  },
  {
    name: "demean",
    signature: "demean(x)",
    category: "cross_sectional",
    formula: "x − mean(x, axis=assets)",
    description: "Subtract the cross-sectional mean at each date.",
    intuition: "Creates a zero-sum signal across the universe — long positions exactly offset short positions. Required for dollar-neutral portfolio construction.",
    papers: [],
    examples: ["demean(returns)", "demean(ts_mean(returns, 20))"],
  },
  {
    name: "winsorize",
    signature: "winsorize(x, pct=0.05)",
    category: "cross_sectional",
    formula: "clip(x, Q_pct, Q_{1−pct})",
    description: "Clip extreme cross-sectional values at the given quantile.",
    intuition: "Robustifies signals against data errors and micro-cap outliers. The default 5% winsorization follows standard practice in factor research.",
    papers: ["GRINOLD99"],
    examples: ["winsorize(returns, 0.02)", "rank(winsorize(volume, 0.05))"],
  },
  // Time-series
  {
    name: "ts_delta",
    signature: "ts_delta(x, d)",
    category: "time_series",
    formula: "x(t) − x(t−d)",
    description: "First difference with lag d. Measures change over the past d days per asset.",
    intuition: "The building block for momentum and reversal signals. ts_delta(close, 5) = 5-day price change. Negating and ranking creates a short-term reversal factor (Lehmann 1990).",
    papers: ["LEHMANN90", "JT93"],
    examples: ["rank(-ts_delta(close, 5))", "ts_delta(volume, 20)"],
  },
  {
    name: "ts_mean",
    signature: "ts_mean(x, d)",
    category: "time_series",
    formula: "∑_{i=0}^{d−1} x(t−i) / d",
    description: "Rolling d-day mean per asset.",
    intuition: "Smooths noisy signals to reduce spurious IC volatility. Increasing d trades off responsiveness for consistency. A key hyperparameter in most practical alpha implementations.",
    papers: ["MOSKOWITZ12"],
    examples: ["rank(-ts_mean(returns, 5))", "ts_mean(volume, 20)"],
  },
  {
    name: "ts_std",
    signature: "ts_std(x, d)",
    category: "time_series",
    formula: "√(Var[x(t−d:t)])",
    description: "Rolling d-day standard deviation per asset.",
    intuition: "Measures realized volatility. Used to build the low-volatility anomaly (Ang et al. 2006, Blitz & Van Vliet 2007): low-vol stocks tend to outperform on a risk-adjusted basis.",
    papers: ["ANG06", "BLITZ11"],
    examples: ["rank(-ts_std(returns, 20))", "rank(returns) / ts_std(returns, 20)"],
  },
  {
    name: "ts_corr",
    signature: "ts_corr(x, y, d)",
    category: "time_series",
    formula: "Corr(x(t−d:t), y(t−d:t))  per asset",
    description: "Rolling d-day Pearson correlation between features x and y for each asset.",
    intuition: "Captures the relationship between two time series for each asset. A negative correlation between returns and volume (price falls on high volume) is a classic sell signal. Chordia et al. (2001) document the volume-return relationship.",
    papers: ["CHORDIA01"],
    examples: [
      "rank(ts_corr(returns, volume, 20)) * -1",
      "rank(-ts_corr(close, volume, 10))",
    ],
  },
  {
    name: "ts_decay_linear",
    signature: "ts_decay_linear(x, d)",
    category: "time_series",
    formula: "∑_{i=0}^{d−1} w_i · x(t−i),  w_i = (d−i) / ∑w",
    description: "Linearly weighted moving average — most recent observation has highest weight.",
    intuition: "Reduces turnover compared to raw signals by dampening day-to-day changes, while weighting recent observations more than a simple rolling mean. A standard tool for signal smoothing in WorldQuant alphas.",
    papers: ["GRINOLD99"],
    examples: [
      "rank(ts_decay_linear(returns, 10))",
      "ts_decay_linear(rank(-returns), 5)",
    ],
  },
  {
    name: "ts_rank",
    signature: "ts_rank(x, d)",
    category: "time_series",
    formula: "2 × (rank of x(t) within x(t−d:t)) / d − 1",
    description: "Rank of today's value within its own past d-day history per asset.",
    intuition: "Measures how extreme today's reading is relative to recent history, independently for each asset. Useful when absolute levels differ widely across assets.",
    papers: [],
    examples: ["rank(ts_rank(volume, 20))", "ts_rank(returns, 60)"],
  },
  {
    name: "ts_delay",
    signature: "ts_delay(x, d)",
    category: "time_series",
    formula: "x(t−d)",
    description: "d-period lag of the signal.",
    intuition: "Used to compare current values to historical baselines, or to avoid look-ahead bias when constructing derived features.",
    papers: [],
    examples: ["ts_delta(close, 5) - ts_delay(ts_delta(close, 5), 20)"],
  },
  // Group
  {
    name: "group_neutralize",
    signature: "group_neutralize(x, group)",
    category: "group",
    formula: "x − mean(x | group)",
    description: "Subtract the group mean from the signal, creating a group-neutral signal.",
    intuition: "Removes sector/industry bets. A signal with sector exposure is partly a bet on which sectors do well, not pure stock selection. WorldQuant and Numerai both prefer neutralized alphas — they combine better with other signals.",
    papers: ["FF93"],
    examples: [
      "group_neutralize(rank(-returns), sector)",
      "group_neutralize(rank(ts_std(returns, 20)), sector)",
    ],
  },
  {
    name: "group_rank",
    signature: "group_rank(x, group)",
    category: "group",
    formula: "rank(x | group) per group",
    description: "Cross-sectional rank within each group at each date.",
    intuition: "Normalizes a signal relative to peers in the same sector, avoiding the issue that some sectors systematically have higher/lower raw factor values.",
    papers: ["FF93"],
    examples: ["group_rank(ts_std(returns, 20), sector)"],
  },
];

// ── Feature Docs ──────────────────────────────────────────────────────────

export const FEATURE_DOCS: Record<string, FeatureDoc> = {
  mom_21d: {
    name: "mom_21d",
    category: "Momentum",
    formula: "∑ r(t−20:t)",
    description: "21-day cumulative return (1-month momentum).",
    intuition: "The most studied factor in empirical finance. Jegadeesh & Titman (1993) showed that past 3–12 month winners continue to outperform. 1-month is sometimes excluded to avoid reversal contamination.",
    papers: ["JT93"],
  },
  mom_252d: {
    name: "mom_252d",
    category: "Momentum",
    formula: "∑ r(t−251:t)",
    description: "252-day return (12-month momentum).",
    intuition: "The canonical momentum signal. Skip the most recent month (mom_252d - mom_21d) to avoid the short-term reversal that contaminates the 12-month signal. Standard in Fama-French 5-factor models.",
    papers: ["JT93", "FF93"],
  },
  reversal_5d: {
    name: "reversal_5d",
    category: "Reversal",
    formula: "−∑ r(t−4:t)",
    description: "Negative of 5-day cumulative return (short-term reversal).",
    intuition: "Lehmann (1990) documents strong 1-week return reversals in US stocks. Likely driven by market microstructure: liquidity providers absorbing temporary order flow imbalances. High turnover limits practical value.",
    papers: ["LEHMANN90"],
  },
  vol_21d: {
    name: "vol_21d",
    category: "Volatility",
    formula: "σ(r(t−20:t)) × √252",
    description: "21-day realized volatility, annualized.",
    intuition: "Ang et al. (2006) document the low-volatility anomaly: stocks with high idiosyncratic volatility earn anomalously low returns. This contradicts CAPM and remains one of the most robust cross-sectional anomalies.",
    papers: ["ANG06", "BLITZ11"],
  },
  rsi_14: {
    name: "rsi_14",
    category: "Technical",
    formula: "100 − 100/(1 + EMA(gains,14)/EMA(losses,14))",
    description: "14-day Relative Strength Index.",
    intuition: "Oscillator bounded [0,100]. Values above 70 indicate overbought, below 30 oversold. In cross-sectional context, extremes may identify mean reversion candidates. Widely used in systematic strategies despite mixed academic evidence.",
    papers: [],
  },
  macd_hist: {
    name: "macd_hist",
    category: "Technical",
    formula: "(EMA(12) − EMA(26)) − EMA(signal,9)",
    description: "MACD histogram — difference between MACD line and its 9-day signal line.",
    intuition: "Captures acceleration in price trends. Positive histogram = bullish momentum accelerating. Common entry signal in trend-following CTAs and systematic macro strategies.",
    papers: ["MOSKOWITZ12"],
  },
  vol_ratio_5d: {
    name: "vol_ratio_5d",
    category: "Volume",
    formula: "volume(t) / MA(volume, 5)",
    description: "Today's volume relative to 5-day average.",
    intuition: "Volume spikes often precede price moves. Chordia et al. (2001) link liquidity and trading activity to short-term return predictability. High volume on down days is a bearish signal.",
    papers: ["CHORDIA01"],
  },
  pct_from_52w_high: {
    name: "pct_from_52w_high",
    category: "Technical",
    formula: "(close − max(close, 252)) / max(close, 252)",
    description: "Percentage below 52-week high.",
    intuition: "George & Hwang (2004) show that the 52-week high is a strong predictor of future returns — stocks near their high tend to continue outperforming. Related to anchoring bias and reference point effects.",
    papers: [],
  },
};

// ── Example Alpha Citations ───────────────────────────────────────────────

export const EXAMPLE_CITATIONS: Record<string, string[]> = {
  "Short-Term Reversal": ["LEHMANN90"],
  "Volume-Price Divergence": ["CHORDIA01"],
  "Vol-Adjusted Reversal": ["LEHMANN90", "ANG06"],
  "Sector-Neutral Reversal": ["LEHMANN90", "FF93"],
  "Decay-Weighted Momentum": ["JT93", "MOSKOWITZ12"],
  "Volume Breakout": ["CHORDIA01"],
};

// ── Video Resources ───────────────────────────────────────────────────────

export interface VideoResource {
  title: string;
  channel: string;
  url: string;
  duration: string;   // e.g. "42 min"
  description: string;
  tags: string[];     // operator/feature names this video covers
}

export const VIDEOS: VideoResource[] = [
  {
    title: "What Is a Factor? The Arithmetic of Active Management",
    channel: "Patrick Boyle",
    url: "https://www.youtube.com/watch?v=jn0x4yIYKoQ",
    duration: "35 min",
    description: "Clear walkthrough of what systematic factors are, why they work, and why most active managers underperform. Essential framing for cross-sectional alpha research.",
    tags: ["rank", "zscore", "mom_21d", "mom_252d"],
  },
  {
    title: "The Momentum Effect — Does It Still Work?",
    channel: "Patrick Boyle",
    url: "https://www.youtube.com/watch?v=1il-s7h3v4U",
    duration: "28 min",
    description: "Covers Jegadeesh-Titman (1993), the robustness of momentum across asset classes, and the 2009 momentum crash. Directly relevant to ts_delta and mom_* features.",
    tags: ["ts_delta", "ts_delay", "mom_21d", "mom_63d", "mom_252d", "reversal_5d"],
  },
  {
    title: "How Renaissance Technologies' Medallion Fund Made 66% Annual Returns",
    channel: "Patrick Boyle",
    url: "https://www.youtube.com/watch?v=Fp7DgFQtfQs",
    duration: "31 min",
    description: "The best publicly available account of how Simons' team built the Medallion Fund — signal discovery, error-correcting codes applied to price data, and the role of autocorrelation in their early signals.",
    tags: ["ts_corr", "ts_autocorr", "ts_mean", "ts_decay_linear"],
  },
  {
    title: "Quantitative Finance Full Course",
    channel: "WorldQuant University",
    url: "https://www.youtube.com/playlist?list=PLvDUPp0rLFGkzQhF0rkLXGNNz-HY4l_GQ",
    duration: "Series",
    description: "Free university-level course from WorldQuant covering factor construction, portfolio optimization, and risk models. Directly aligned with WorldQuant BRAIN competition.",
    tags: ["rank", "zscore", "group_neutralize", "group_rank"],
  },
  {
    title: "The Low Volatility Anomaly",
    channel: "Patrick Boyle",
    url: "https://www.youtube.com/watch?v=IkWR7wPPLT0",
    duration: "24 min",
    description: "Covers Ang et al. (2006) — why high-volatility stocks earn lower returns, contradicting CAPM. The vol_21d and vol_63d features directly test this anomaly.",
    tags: ["vol_21d", "vol_63d", "ts_std", "vol_ratio_5_21"],
  },
  {
    title: "IC, IR, and the Fundamental Law of Active Management",
    channel: "CFA Institute",
    url: "https://www.youtube.com/watch?v=QWFvpJuKBhk",
    duration: "18 min",
    description: "Grinold & Kahn's Fundamental Law: IR = IC × √N. The mathematical foundation for why breadth (more bets) and IC quality both matter. Essential for interpreting your IC-IR metric.",
    tags: ["rank", "zscore", "demean"],
  },
  {
    title: "Cliff Asness: Fact, Fiction, and Factor Investing",
    channel: "AQR Capital Management",
    url: "https://www.youtube.com/watch?v=T5h6oQFLCu8",
    duration: "55 min",
    description: "AQR co-founder (and Fama's PhD student) on momentum, value, and the academic-practitioner divide. Covers data mining concerns, factor timing, and why simple factors survive.",
    tags: ["mom_21d", "mom_252d", "ts_delta", "reversal_5d", "group_neutralize"],
  },
  {
    title: "Short-Term Reversal: Microstructure or Mispricing?",
    channel: "Alpha Architect",
    url: "https://www.youtube.com/watch?v=xYgZoE34Q1A",
    duration: "22 min",
    description: "Deep dive into why short-term reversal (Lehmann 1990) works — market makers, bid-ask bounce, and liquidity provision. Critical for understanding the reversal_* features.",
    tags: ["reversal_1d", "reversal_5d", "ts_delta"],
  },
  {
    title: "Numerai Tournament Deep Dive",
    channel: "Numerai",
    url: "https://www.youtube.com/watch?v=YojhLjLrG1M",
    duration: "40 min",
    description: "Official walkthrough of the Numerai data format, IC scoring, MMC (Meta-Model Contribution), and what makes a competitive submission. Essential if you plan to compete.",
    tags: ["rank", "zscore", "mom_21d", "vol_21d", "rsi_14"],
  },
];

// ── Blog & Article Resources ──────────────────────────────────────────────

export interface BlogPost {
  title: string;
  source: string;
  url: string;
  date: string;
  description: string;
  tags: string[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    title: "Demystifying the Information Coefficient",
    source: "Flirting With Models (Corey Hoffstein)",
    url: "https://flirtingwithmodels.com/2019/01/07/demystifying-the-information-coefficient/",
    date: "2019",
    description: "The clearest explanation of IC, ICIR, and their relationship to portfolio Sharpe. Hoffstein runs Newfound Research and is one of the best writers in systematic finance.",
    tags: ["rank", "zscore"],
  },
  {
    title: "Alpha Factors: How to Build, Test, and Deploy Them",
    source: "Quantpedia",
    url: "https://quantpedia.com/how-to-build-test-and-deploy-alpha-factors/",
    date: "2023",
    description: "Quantpedia maintains a database of 900+ published trading strategies with performance statistics. This post explains factor construction methodology.",
    tags: ["ts_delta", "ts_corr", "rank", "mom_21d"],
  },
  {
    title: "The Replication Crisis in Finance",
    source: "Alpha Architect",
    url: "https://alphaarchitect.com/2023/06/the-replication-crisis-in-factor-investing/",
    date: "2023",
    description: "Why most published factor alphas disappear post-publication. Harvey, Liu & Zhu (2016) found that 85% of discovered factors are likely false positives. Critical context for IC skepticism.",
    tags: ["mom_21d", "vol_21d", "rsi_14", "reversal_5d"],
  },
  {
    title: "Momentum Crashes",
    source: "AQR Insights",
    url: "https://www.aqr.com/Insights/Research/Journal-Article/Momentum-Crashes",
    date: "2016",
    description: "Daniel & Moskowitz (2016) — momentum strategies occasionally experience severe crashes (e.g., 2009: −73% in a single month). Explains why vol-adjusting momentum matters.",
    tags: ["mom_63d", "mom_252d", "ts_decay_linear", "vol_21d"],
  },
  {
    title: "The WorldQuant BRAIN Cookbook",
    source: "WorldQuant",
    url: "https://platform.worldquant.com/alpha/create",
    date: "2024",
    description: "WorldQuant's official operator reference for their simulation platform — the direct inspiration for this app's DSL. Includes fitness criteria, operator documentation, and submission guidelines.",
    tags: ["rank", "ts_corr", "ts_decay_linear", "group_neutralize", "winsorize"],
  },
  {
    title: "Two Sigma's Guide to Quantitative Research",
    source: "Two Sigma",
    url: "https://www.twosigma.com/articles/a-practitioner-s-guide-to-quantitative-research/",
    date: "2022",
    description: "Practitioner perspective from one of the largest quant funds. Covers the full pipeline from data → signal → portfolio construction → risk management.",
    tags: ["rank", "group_neutralize", "vol_21d", "ts_std"],
  },
  {
    title: "Factor Momentum Everywhere",
    source: "AQR",
    url: "https://www.aqr.com/Insights/Research/Journal-Article/Factor-Momentum-Everywhere",
    date: "2019",
    description: "Gupta & Kelly (2019): individual stock momentum is largely explained by momentum in the underlying factors (value, quality, etc.). Suggests combining multiple factors is more robust.",
    tags: ["mom_21d", "mom_63d", "group_rank", "group_neutralize"],
  },
  {
    title: "Understanding Purged Cross-Validation",
    source: "Advances in Financial Machine Learning (de Prado)",
    url: "https://www.amazon.com/Advances-Financial-Machine-Learning-Marcos/dp/1119482089",
    date: "2018",
    description: "Marcos Lopez de Prado's canonical text on ML for systematic trading. Chapter 7 covers why standard k-fold CV leaks information in time-series settings and how purging + embargo prevents this.",
    tags: ["mom_21d", "vol_21d", "rsi_14", "macd_hist"],
  },
];

// ── Historical Context ────────────────────────────────────────────────────

export interface HistoricalContext {
  id: string;
  figure: string;
  firm: string;
  period: string;
  headline: string;
  narrative: string;
  outcome: string;
  relevantTags: string[];   // operator/feature names
  furtherReading?: string;  // URL
}

export const HISTORICAL_CONTEXTS: HistoricalContext[] = [
  {
    id: "simons_medallion",
    figure: "Jim Simons",
    firm: "Renaissance Technologies",
    period: "1988 – present",
    headline: "The Medallion Fund: 66% gross annual returns for 30+ years",
    narrative:
      "Simons, a former NSA codebreaker and Stony Brook math chair, founded Renaissance in 1982. His early insight — developed with Elwyn Berlekamp and Leonard Baum — was that price series contain weak but exploitable autocorrelations, similar to signal-in-noise problems in information theory. The team applied hidden Markov models to find persistent short-term patterns. Critically, they discovered that most of the edge came from holding periods of minutes to days, not weeks — meaning the ts_corr and ts_mean operators at short lookbacks (2–10 days) were their bread and butter, not long-term momentum.",
    outcome:
      "The Medallion Fund returned 66% annually before fees (39% after) from 1988–2018. It has never had a losing year. Its Sharpe ratio is estimated at 2.5–3.0 — far above any known benchmark. It is now closed to outside investors.",
    relevantTags: ["ts_corr", "ts_autocorr", "ts_mean", "ts_decay_linear"],
    furtherReading: "https://www.amazon.com/Man-Who-Solved-Market-Revolution/dp/073521798X",
  },
  {
    id: "asness_momentum",
    figure: "Cliff Asness",
    firm: "AQR Capital Management",
    period: "1994 – present",
    headline: "The academic who took momentum to $140B AUM",
    narrative:
      "Asness wrote his 1994 University of Chicago PhD dissertation under Eugene Fama on momentum — a factor that directly contradicted Fama's own Efficient Market Hypothesis. Fama reportedly told him to bury the finding. Instead, Asness went to Goldman Sachs to test it live, then co-founded AQR in 1998 to run it at scale. AQR's flagship strategy combines momentum (JT93 style: rank stocks by 12-1 month returns) with value, and sector-neutralizes both. The group_neutralize operator is central to their implementation.",
    outcome:
      "AQR manages ~$140B. The momentum factor has survived 30 years of out-of-sample testing across 40+ markets. However, AQR's public funds had a brutal 2018–2020 'factor winter' where value and momentum both underperformed, leading to $80B in outflows before recovering.",
    relevantTags: ["mom_252d", "mom_63d", "group_neutralize", "ts_delta", "rank"],
    furtherReading: "https://www.aqr.com/Insights/Research/Journal-Article/Fact-Fiction-and-Momentum-Investing",
  },
  {
    id: "shaw_statarb",
    figure: "David Shaw",
    firm: "D.E. Shaw",
    period: "1988 – present",
    headline: "The computer scientist who invented statistical arbitrage",
    narrative:
      "Shaw was a Columbia CS professor when he founded D.E. Shaw in 1988 with $28M. His insight was that pairs of stocks with historically correlated prices occasionally diverge, and the divergence mean-reverts — a signal captured by ts_corr and reversal operators. D.E. Shaw pioneered computational statistical arbitrage at a time when most trading was still manual. They hired scientists, not finance people. Jeff Bezos was a vice president at D.E. Shaw before leaving to found Amazon in 1994.",
    outcome:
      "D.E. Shaw now manages ~$60B. Their Composite fund averaged 19.4% annually from 1989–2017. They expanded into life sciences and computational drug discovery using the same systematic approach.",
    relevantTags: ["ts_corr", "reversal_5d", "reversal_1d", "ts_std", "rank"],
    furtherReading: "https://en.wikipedia.org/wiki/D._E._Shaw_%26_Co.",
  },
  {
    id: "ltcm_collapse",
    figure: "Robert Merton & Myron Scholes",
    firm: "Long-Term Capital Management",
    period: "1994 – 1998",
    headline: "The Nobel laureates who blew up the financial system",
    narrative:
      "LTCM was founded in 1994 by John Meriwether with Merton and Scholes (who won the Nobel Prize in 1997 partly for work done at LTCM). Their strategy was sophisticated mean-reversion: when yield spreads between similar bonds diverged, buy the cheap one and short the expensive one. The ts_corr between instruments was their core signal. By 1998 they had $125B in assets and $1.25 trillion in notional derivatives exposure — 25x leverage. When Russia defaulted in August 1998, correlations across all their positions went to 1 simultaneously. They lost $4.6B in four months.",
    outcome:
      "The Federal Reserve orchestrated a $3.6B bailout by 14 banks to prevent systemic collapse. LTCM's failure became the canonical case study for model risk, correlation breakdown in crisis, and the dangers of overcrowding a trade. It directly inspired the 2008 Dodd-Frank risk regulations.",
    relevantTags: ["ts_corr", "ts_std", "vol_21d", "group_neutralize"],
    furtherReading: "https://www.amazon.com/When-Genius-Failed-Long-Term-Management/dp/0375758259",
  },
  {
    id: "siegel_twosigma",
    figure: "David Siegel & John Overdeck",
    firm: "Two Sigma",
    period: "2001 – present",
    headline: "The first major fund to fully embrace machine learning",
    narrative:
      "Siegel (a former D.E. Shaw quant) and Overdeck (a former D.E. Shaw trader and International Math Olympiad gold medalist) founded Two Sigma in 2001 explicitly to use data science and ML at scale. While Renaissance used classical statistical methods, Two Sigma pioneered the use of neural networks, gradient boosting, and alternative data (satellite imagery, credit card transactions, social media) in factor construction. Their ML pipeline mirrors exactly what this app's ML tab does — features → LightGBM → cross-sectional ranking → portfolio.",
    outcome:
      "Two Sigma manages ~$60B. Their Venn platform open-sources factor decomposition for institutional investors. They are one of the largest recruiters of ML PhD graduates on Wall Street.",
    relevantTags: ["mom_21d", "vol_21d", "rsi_14", "macd_hist", "reversal_5d"],
    furtherReading: "https://www.twosigma.com/articles/a-practitioner-s-guide-to-quantitative-research/",
  },
  {
    id: "fama_french",
    figure: "Eugene Fama & Kenneth French",
    firm: "University of Chicago / Dartmouth",
    period: "1992 – present",
    headline: "The professors who built the factor model framework everyone uses",
    narrative:
      "Fama (Chicago) and French (Dartmouth) published their three-factor model in 1993: market risk, small-cap premium (SMB), and value premium (HML). This directly contradicted Fama's own Efficient Market Hypothesis — he had spent his career arguing markets were efficient, then found anomalies that couldn't be explained away. The Fama-French framework is the benchmark against which every alpha in this app is implicitly measured. Their sector-based groupings and cross-sectional ranking methodology are standard practice — see group_neutralize and group_rank.",
    outcome:
      "Dimensional Fund Advisors (DFA), co-founded by David Booth (a Fama student), built a $700B asset manager entirely on Fama-French principles. Fama won the Nobel Prize in 2013, shared with Robert Shiller — his intellectual opposite on market efficiency.",
    relevantTags: ["group_neutralize", "group_rank", "group_zscore", "rank", "zscore"],
    furtherReading: "https://www.jstor.org/stable/2329112",
  },
];

// ── Tag → Resources lookup ────────────────────────────────────────────────

export function getResourcesForTag(tag: string): {
  videos: VideoResource[];
  posts: BlogPost[];
  contexts: HistoricalContext[];
} {
  return {
    videos: VIDEOS.filter((v) => v.tags.includes(tag)),
    posts: BLOG_POSTS.filter((p) => p.tags.includes(tag)),
    contexts: HISTORICAL_CONTEXTS.filter((h) => h.relevantTags.includes(tag)),
  };
}

// ── Quant World News ──────────────────────────────────────────────────────

export type NewsCategory =
  | "Factor Research"
  | "AI & ML"
  | "Industry"
  | "Regulation"
  | "Markets"
  | "Competition";

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  date: string;
  category: NewsCategory;
  summary: string;
  url: string;
  isHot?: boolean;   // flag for particularly significant items
}

export const NEWS_ITEMS: NewsItem[] = [
  {
    id: "factor-zoo-2024",
    title: "The Factor Zoo Is Getting Crowded — And Most Factors Don't Survive",
    source: "Journal of Finance / Alpha Architect",
    date: "2024",
    category: "Factor Research",
    isHot: true,
    summary:
      "Harvey, Liu & Zhu's landmark study found that of 400+ published factors, the majority are likely false positives — the result of data mining, p-hacking, and publication bias. The multiple-testing problem means t-statistics of 3.0+ are required for credibility, not the traditional 2.0. Directly relevant to why your IC needs to be robust across time periods, not just the full sample.",
    url: "https://alphaarchitect.com/2023/06/the-replication-crisis-in-factor-investing/",
  },
  {
    id: "aqr-value-comeback",
    title: "Value's Comeback: AQR's Worst Decade Becomes Its Best Argument",
    source: "Institutional Investor",
    date: "2023–2024",
    category: "Industry",
    isHot: true,
    summary:
      "After losing $80B in AUM during 2018–2020's 'factor winter' — when value and momentum both underperformed — AQR's strategies recovered sharply in 2022–2024 as interest rates rose and the growth-value rotation played out. Cliff Asness called 2020–2021 'the most overvalued market relative to fundamentals' in recorded history. The cycle illustrates why factor timing and regime awareness (what the Signal Analysis panel shows) matters as much as signal quality.",
    url: "https://www.aqr.com/Insights/Perspectives/The-Long-Run-Is-Lying-to-You",
  },
  {
    id: "medallion-covid",
    title: "Renaissance's Medallion Fund Returned +76% in 2020 While Its Public Funds Lost 30%",
    source: "Bloomberg",
    date: "2020",
    category: "Industry",
    isHot: true,
    summary:
      "In the COVID crash and recovery, Renaissance's internal Medallion Fund — which uses ultra-short-term signals (minutes to days) — gained 76% gross. But its public funds (RIEF, RIDA), which use longer-horizon factors similar to what this app tests, lost 20–30%. The divergence revealed a structural difference: short-term microstructure signals are uncorrelated with longer-horizon factor signals. Medallion employees pay 5% management + 44% performance fees and still earn 39% net annually.",
    url: "https://www.bloomberg.com/news/articles/2020-05-05/how-medallion-fund-made-billions-during-coronavirus",
  },
  {
    id: "two-sigma-altdata",
    title: "Two Sigma Processed 15 Petabytes of Alternative Data in 2023",
    source: "Two Sigma / FT",
    date: "2023",
    category: "AI & ML",
    summary:
      "Two Sigma's data science team now ingests satellite imagery (counting cars in parking lots), credit card transaction feeds, job posting rates, and shipping container tracking alongside traditional price/volume data. Their key insight: alternative data sources are most valuable when combined with standard price features via ML — exactly what the ML tab does. The alpha from any single alt-data source decays within 12–18 months as competitors replicate it.",
    url: "https://www.twosigma.com/articles/a-practitioner-s-guide-to-quantitative-research/",
  },
  {
    id: "numerai-signals",
    title: "Numerai Signals: Crowdsourcing the World's Hedge Fund",
    source: "Numerai",
    date: "2024",
    category: "Competition",
    isHot: true,
    summary:
      "Numerai Signals lets anyone submit stock-level predictions (alpha signals) on real equities. Submissions are evaluated on Spearman IC against forward returns and on MMC (Meta-Model Contribution) — how much your signal adds beyond what the crowd already knows. The platform now aggregates predictions from 10,000+ data scientists globally. Competitive IC threshold is ~0.02; competitive ICIR is ~0.5. Payouts are in NMR (Numeraire) tokens staked on your own performance.",
    url: "https://signals.numer.ai",
  },
  {
    id: "worldquant-brain-2024",
    title: "WorldQuant BRAIN Opens to 350,000+ Researchers in 180 Countries",
    source: "WorldQuant",
    date: "2024",
    category: "Competition",
    summary:
      "WorldQuant's BRAIN simulation platform — the direct inspiration for this app's DSL — has processed over 4 million alpha submissions. Alphas are evaluated on Sharpe (>1.0), Fitness (IC × √252 / turnover), and Neutralization. Top performers earn WorldQuant consultant status and portfolio allocation. The platform's operators (rank, ts_corr, group_neutralize) are identical to this app's DSL.",
    url: "https://platform.worldquant.com/",
  },
  {
    id: "momentum-crash-2020",
    title: "The Momentum Crash of 2020: -73% in One Month",
    source: "AQR / Journal of Finance",
    date: "2020",
    category: "Markets",
    isHot: true,
    summary:
      "In April 2020, following the COVID crash, momentum strategies lost ~73% as the most-beaten-down stocks (energy, travel, retail) exploded upward and recent winners sold off. Daniel & Moskowitz (2016) predicted this would happen — momentum crashes tend to follow market crashes as optionality in beaten-down stocks kicks in. The fix: vol-scale momentum (divide signal by realized volatility) to reduce exposure during high-vol regimes. This is why ts_std appears in almost every competitive momentum alpha.",
    url: "https://www.aqr.com/Insights/Research/Journal-Article/Momentum-Crashes",
  },
  {
    id: "sec-algo-reg",
    title: "SEC Proposes New Rules on Algorithmic Trading Disclosure",
    source: "SEC / Risk.net",
    date: "2024",
    category: "Regulation",
    summary:
      "The SEC's Regulation AT proposal would require systematic trading firms to register algorithmic strategies, maintain source code records, and implement pre-trade risk controls. The rule targets HFT but impacts all systematic funds. Separately, the EU's MiCA framework regulates crypto-systematic strategies. The broader regulatory trend: regulators increasingly treat quant strategies as infrastructure risk, not just investment risk — particularly after 2010's Flash Crash and 2020's volatility spikes.",
    url: "https://www.sec.gov/rules/proposed/2022/34-96496.pdf",
  },
  {
    id: "ml-overfit-debate",
    title: "Is Machine Learning Finding Real Alpha or Just Overfitting History?",
    source: "Journal of Financial Economics / SSRN",
    date: "2023–2024",
    category: "AI & ML",
    isHot: true,
    summary:
      "Gu, Kelly & Xiu (2020) showed that neural networks and gradient boosting significantly outperform linear factor models on US equities out-of-sample. But McLean & Pontiff (2016) documented that 97 anomalies lose ~32% of their return post-publication as arbitrage capital flows in. The open debate: ML models may be 'discovering' factors that are already crowded by the time you backtest them. Purged cross-validation (what the ML tab implements) helps — but survivorship bias in the universe and lookahead in feature construction remain hard to eliminate.",
    url: "https://onlinelibrary.wiley.com/doi/abs/10.1111/jofi.13009",
  },
  {
    id: "ff6-factor",
    title: "Fama & French Add a 6th Factor: Investment and Profitability Updated",
    source: "Journal of Finance",
    date: "2018–2024",
    category: "Factor Research",
    summary:
      "The canonical Fama-French 3-factor model (1993) grew to 5 factors in 2015 (adding profitability and investment) and continues to be refined. The 6-factor extension adds momentum — ironic, since Fama built his career on the Efficient Market Hypothesis that momentum contradicts. Chicago's finance faculty now includes both EMH believers and its most prominent critics. The 5-factor model is the current standard for benchmarking alphas; any factor that survives after controlling for it is genuinely interesting.",
    url: "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html",
  },
  {
    id: "citadel-ken-griffin",
    title: "Citadel Posted 38% Returns in 2022 — Its Best Year Ever",
    source: "Bloomberg / FT",
    date: "2022",
    category: "Industry",
    summary:
      "Citadel's flagship Wellington fund returned 38% in 2022, its best year in 32 years, earning $16B — the most ever made by a hedge fund in a single year. The performance came from macro positioning (short rates, short tech) combined with quantitative equity strategies. Ken Griffin's firm now manages $62B across multi-strat, quant equity, and macro pods. Citadel Securities (its separate market-making arm) executes ~27% of all US retail equity volume daily.",
    url: "https://www.ft.com/content/citadel-hedge-fund-2022",
  },
  {
    id: "alpha-decay",
    title: "Alpha Decay: How Fast Does Your Edge Disappear?",
    source: "Quantpedia / SSRN",
    date: "2024",
    category: "Factor Research",
    summary:
      "Studies show the average factor loses ~30% of its out-of-sample alpha within 5 years of publication. Short-term microstructure signals decay fastest (days to weeks). Long-horizon value and quality signals decay slowest (years). The implication for this app: backtesting 2020–2024 on factors published before 2020 will overstate future performance — the market has already arbitraged away part of the edge. Post-publication decay is the primary reason WorldQuant and Numerai evaluate on live, forward performance rather than backtests.",
    url: "https://quantpedia.com/alpha-decay-in-factor-investing/",
  },
];

export const NEWS_CATEGORIES: NewsCategory[] = [
  "Factor Research",
  "AI & ML",
  "Industry",
  "Regulation",
  "Markets",
  "Competition",
];
