"""
Vectorized cross-sectional backtest engine.

Produces:
  - IC series (Spearman rank correlation between alpha scores and forward returns)
  - Long-short equity curve
  - Turnover, hit rate, drawdown
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import spearmanr


def run_backtest(
    alpha: pd.DataFrame,
    returns: pd.DataFrame,
    forward_days: int = 5,
    long_short_pct: float = 0.20,
    sector_neutral: bool = False,
    sector: pd.DataFrame | None = None,
) -> dict:
    """
    Parameters
    ----------
    alpha        : Date × Asset alpha scores (raw, not necessarily normalized)
    returns      : Date × Asset daily returns
    forward_days : forward-return horizon
    long_short_pct: top/bottom percentile for long-short portfolio
    sector_neutral: demean alpha within sector before portfolio construction

    Returns
    -------
    dict with keys:
        ic_series, equity_curve, metrics
    """
    # Align
    common_cols = alpha.columns.intersection(returns.columns)
    alpha = alpha[common_cols]
    returns = returns[common_cols]

    # Winsorize extreme alpha values cross-sectionally
    alpha = _winsorize_cross_sectional(alpha, 0.01)

    # Compute forward returns
    fwd_returns = _forward_returns(returns, forward_days)

    # Sector neutralize alpha if requested
    if sector_neutral and sector is not None:
        alpha = _sector_demean(alpha, sector[common_cols])

    # IC series (Spearman correlation at each date)
    ic_series = _compute_ic_series(alpha, fwd_returns)

    # Long-short portfolio weights
    weights = _build_ls_weights(alpha, long_short_pct)

    # Daily PnL (use 1-day returns for daily rebalance simulation)
    # Position taken at close t, return realized t+1
    shifted_weights = weights.shift(1)
    daily_pnl = (shifted_weights * returns).sum(axis=1)

    # Cumulative equity
    equity = (1 + daily_pnl).cumprod()

    # Turnover
    turnover = _compute_turnover(weights)

    # Metrics
    metrics = _compute_metrics(daily_pnl, ic_series, turnover)

    # Annotate factor return by quantile (decile returns)
    quantile_returns = _compute_quantile_returns(alpha, returns)

    return {
        "ic_series": _to_records(ic_series.rename("ic")),
        "equity_curve": _to_records(equity.rename("value")),
        "daily_pnl": _to_records(daily_pnl.rename("pnl")),
        "turnover": _to_records(turnover.rename("turnover")),
        "quantile_returns": quantile_returns,
        "metrics": metrics,
    }


def _forward_returns(returns: pd.DataFrame, d: int) -> pd.DataFrame:
    """Compound forward returns over d days, aligned to current date."""
    fwd = (1 + returns).rolling(d).apply(np.prod, raw=True).shift(-d)
    return fwd - 1


def _winsorize_cross_sectional(alpha: pd.DataFrame, pct: float) -> pd.DataFrame:
    lo = alpha.quantile(pct, axis=1)
    hi = alpha.quantile(1 - pct, axis=1)
    return alpha.clip(lower=lo, upper=hi, axis=0)


def _sector_demean(alpha: pd.DataFrame, sector: pd.DataFrame) -> pd.DataFrame:
    result = alpha.copy()
    for date in alpha.index:
        row = alpha.loc[date]
        grp = sector.loc[date]
        for g in grp.unique():
            mask = grp == g
            sub = row[mask]
            result.loc[date, mask] = (sub - sub.mean()).values
    return result


def _compute_ic_series(alpha: pd.DataFrame, fwd_returns: pd.DataFrame) -> pd.Series:
    """Spearman IC at each date."""
    common_idx = alpha.index.intersection(fwd_returns.index)
    ics = []
    for date in common_idx:
        a = alpha.loc[date].dropna()
        r = fwd_returns.loc[date].dropna()
        common = a.index.intersection(r.index)
        if len(common) < 10:
            ics.append(np.nan)
            continue
        ic, _ = spearmanr(a[common].values, r[common].values)
        ics.append(ic if np.isfinite(ic) else np.nan)
    return pd.Series(ics, index=common_idx)


def _build_ls_weights(alpha: pd.DataFrame, pct: float) -> pd.DataFrame:
    """Build equal-weighted long-short portfolio weights."""
    weights = pd.DataFrame(0.0, index=alpha.index, columns=alpha.columns)
    for date in alpha.index:
        scores = alpha.loc[date].dropna()
        n = len(scores)
        if n < 10:
            continue
        lo_cut = scores.quantile(pct)
        hi_cut = scores.quantile(1 - pct)
        longs = scores[scores >= hi_cut].index
        shorts = scores[scores <= lo_cut].index
        if len(longs) > 0:
            weights.loc[date, longs] = 1.0 / len(longs)
        if len(shorts) > 0:
            weights.loc[date, shorts] = -1.0 / len(shorts)
    return weights


def _compute_turnover(weights: pd.DataFrame) -> pd.Series:
    """Daily turnover as a fraction of the book (WorldQuant convention).

    Weights hold +1 long and -1 short, so gross exposure is 2. Dividing the
    absolute weight change by 2 expresses trading as a share of that gross book.
    """
    return weights.diff().abs().sum(axis=1) / 2.0


def _compute_quantile_returns(
    alpha: pd.DataFrame,
    returns: pd.DataFrame,
    n_quantiles: int = 5,
) -> list[dict]:
    """Average next-day return by alpha quintile."""
    fwd = returns.shift(-1)
    quantile_rets = {str(i + 1): [] for i in range(n_quantiles)}

    for date in alpha.index:
        a = alpha.loc[date].dropna()
        r = fwd.loc[date].dropna()
        common = a.index.intersection(r.index)
        if len(common) < n_quantiles * 2:
            continue
        combined = pd.DataFrame({"alpha": a[common], "ret": r[common]})
        combined["q"] = pd.qcut(combined["alpha"], n_quantiles, labels=False, duplicates="drop")
        q_means = combined.groupby("q")["ret"].mean()
        for q in range(n_quantiles):
            quantile_rets[str(q + 1)].append(q_means.get(q, np.nan))

    return [
        {"quantile": q, "mean_return": float(np.nanmean(v)) if v else 0.0}
        for q, v in quantile_rets.items()
    ]


def _compute_metrics(
    daily_pnl: pd.Series,
    ic_series: pd.Series,
    turnover: pd.Series,
) -> dict:
    pnl = daily_pnl.dropna()
    ic = ic_series.dropna()

    # Returns
    annual_return = (1 + pnl).prod() ** (252 / max(len(pnl), 1)) - 1

    # Sharpe / Sortino
    sharpe = float(pnl.mean() / pnl.std() * np.sqrt(252)) if pnl.std() > 0 else 0.0
    downside = pnl[pnl < 0].std()
    sortino = float(pnl.mean() / downside * np.sqrt(252)) if downside > 0 else 0.0

    # Max drawdown
    cum = (1 + pnl).cumprod()
    roll_max = cum.cummax()
    drawdown = (cum - roll_max) / roll_max
    max_dd = float(drawdown.min())

    # IC metrics
    ic_mean = float(ic.mean()) if len(ic) > 0 else 0.0
    ic_std = float(ic.std()) if len(ic) > 1 else 1.0
    ic_ir = float(ic_mean / ic_std) if ic_std > 0 else 0.0
    hit_rate = float((ic > 0).mean()) if len(ic) > 0 else 0.0

    # Turnover
    avg_turnover = float(turnover.dropna().mean())

    return {
        "annual_return": round(annual_return, 4),
        "sharpe": round(sharpe, 3),
        "sortino": round(sortino, 3),
        "max_drawdown": round(max_dd, 4),
        "ic_mean": round(ic_mean, 4),
        "ic_std": round(ic_std, 4),
        "ic_ir": round(ic_ir, 3),
        "hit_rate": round(hit_rate, 3),
        "avg_daily_turnover": round(avg_turnover, 3),
        "n_trading_days": len(pnl),
    }


def _to_records(series: pd.Series) -> list[dict]:
    """Convert Series to [{date, value}, ...] for JSON serialization."""
    return [
        {"date": str(idx.date()) if hasattr(idx, "date") else str(idx), "value": float(v) if np.isfinite(v) else None}
        for idx, v in series.items()
    ]
