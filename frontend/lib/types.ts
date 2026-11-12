export interface Feature {
  name: string;
  category: string;
  description: string;
}

export interface Operator {
  name: string;
  signature: string;
  description: string;
}

export interface OperatorsResponse {
  cross_sectional: Operator[];
  time_series: Operator[];
  group: Operator[];
  element_wise: Operator[];
  data_fields: string[];
  example_alphas: Array<{ name: string; expression: string; description: string }>;
}

export interface BacktestMetrics {
  annual_return: number;
  sharpe: number;
  sortino: number;
  max_drawdown: number;
  ic_mean: number;
  ic_std: number;
  ic_ir: number;
  hit_rate: number;
  avg_daily_turnover: number;
  n_trading_days: number;
}

export interface TimeSeriesPoint {
  date: string;
  value: number | null;
}

export interface QuantileReturn {
  quantile: string;
  mean_return: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

/** One confidence level with the figure from each estimation method. Losses are positive fractions of NAV. */
export interface RiskMethodRow {
  confidence: number;
  historical?: number;
  gaussian: number;
  monte_carlo: number;
  bootstrap?: number;
}

export type VarVerdict = "pass" | "too_many" | "too_few" | "clustered";

export interface VarBacktestRow {
  confidence: number;
  window: number;
  observations: number;
  expected: number;
  exceptions: number;
  rate: number;
  kupiec_p: number;
  independence_p: number;
  verdict: VarVerdict;
}

export interface RiskSeriesPoint {
  date: string;
  pnl: number;
  var95?: number;
  var99?: number;
}

export interface RiskReport {
  n_obs: number;
  distribution: {
    mean: number;
    std: number;
    annual_vol: number;
    skew: number;
    excess_kurtosis: number;
    worst_day: number;
    best_day: number;
    t_df: number;
  };
  var: RiskMethodRow[];
  cvar: RiskMethodRow[];
  horizon: { days: number; var: RiskMethodRow[]; cvar: RiskMethodRow[] };
  backtest: VarBacktestRow[];
  series: RiskSeriesPoint[];
  stress: {
    worst_stretches: { days: number; return: number; start: string; end: string }[];
    windows: { name: string; start: string; end: string; days: number; return: number }[];
    vol_shocks: { multiple: number; confidence: number; var: number; cvar: number }[];
  };
}

export interface BacktestResponse {
  metrics: BacktestMetrics;
  ic_series: TimeSeriesPoint[];
  equity_curve: TimeSeriesPoint[];
  daily_pnl: TimeSeriesPoint[];
  turnover: TimeSeriesPoint[];
  quantile_returns: QuantileReturn[];
  /** Absent on results saved before the risk module, and when there is too little history */
  risk?: RiskReport | null;
  feature_importance?: FeatureImportance[];
  expression?: string;
  elapsed_seconds: number;
}

export interface ExpressionBacktestRequest {
  expression: string;
  universe: string;
  start_date: string;
  end_date: string;
  forward_days: number;
  long_short_pct: number;
  sector_neutral: boolean;
}

export interface MLBacktestRequest {
  features: string[];
  model_type: "lightgbm" | "linear";
  universe: string;
  start_date: string;
  end_date: string;
  forward_days: number;
  n_folds: number;
  embargo_days: number;
}

export type Universe = "sp500" | "etfs" | "forex" | "commodities";
export type ModelType = "lightgbm" | "linear";

// ── WorldQuant BRAIN ────────────────────────────────────────────────────────

export interface WQCredentials {
  username: string;
  password: string;
}

export type WQNeutralization = "SUBINDUSTRY" | "INDUSTRY" | "SECTOR" | "MARKET" | "NONE";
export type WQUniverse = "TOP3000" | "TOP1000" | "TOP500" | "TOP200";

export interface WQSimRequest {
  username: string;
  password: string;
  expression: string;
  region?: string;
  universe?: WQUniverse;
  delay?: number;
  decay?: number;
  neutralization?: WQNeutralization;
  truncation?: number;
}

export interface WQMetrics {
  fitness: number | null;
  sharpe: number | null;
  turnover: number | null;
  returns: number | null;
  drawdown: number | null;
  margin: number | null;
  long_count: number | null;
  short_count: number | null;
  os_fitness: number | null;
  os_sharpe: number | null;
}

export interface WQYearRow {
  year: string;
  sharpe: number | null;
  turnover: number | null;
  fitness: number | null;
  returns: number | null;
  drawdown: number | null;
  margin: number | null;
  long_count: number | null;
  short_count: number | null;
}

export interface WQSimResult {
  status: "done" | "pending" | "submitted" | "error";
  alpha_id: string | null;
  metrics: WQMetrics | null;
  yearly?: WQYearRow[] | null;
  settings?: {
    region: string;
    universe: string;
    neutralization: string;
    delay: number;
  };
}
