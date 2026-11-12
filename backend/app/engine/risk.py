"""
Risk measures for a strategy's daily P&L.

Everything here works from one series, the long-short portfolio's daily return, so it
runs on any backtest the engine produces. Figures are fractions of NAV (0.012 = 1.2%).
VaR and CVaR are reported as positive numbers (the loss to expect); stress results are
signed returns.

  - VaR and CVaR at 95% and 99%: historical, Gaussian, and Monte Carlo from a fitted Student-t
  - A multi-day horizon VaR: Gaussian, bootstrap and Student-t Monte Carlo
  - A rolling VaR backtest with the Kupiec and Christoffersen tests
  - Stress: worst stretches, named market-stress windows, volatility shocks

Assumptions worth knowing: the Gaussian and Monte Carlo methods treat daily returns as
independent, and the horizon numbers compound them that way. Volatility clustering breaks
that, which is what the backtest is there to catch.
"""
from __future__ import annotations

from typing import Optional, Sequence

import numpy as np
import pandas as pd
from numpy.lib.stride_tricks import sliding_window_view
from scipy import stats
from scipy.special import xlogy

CONFIDENCES = (0.95, 0.99)
HORIZON_DAYS = 10
N_SIMS = 50_000
SEED = 7
VAR_WINDOW = 250  # trading days of history behind each rolling VaR forecast
MIN_OBS = 100  # below this, VaR is too noisy to report
MIN_BACKTEST_DAYS = 60  # forecasts needed before the backtest tests mean anything
SIGNIFICANCE = 0.05
STRETCH_DAYS = (1, 5, 20, 60)
VOL_SHOCKS = (1.5, 2.0, 3.0)
T_DF_BOUNDS = (3.0, 100.0)  # keep the fitted tail index finite-variance and numerically sane

# Windows where markets sold off hard. Shown only when the backtest period covers them.
STRESS_WINDOWS = (
    ("Q4 2018 selloff", "2018-10-01", "2018-12-24"),
    ("COVID crash", "2020-02-19", "2020-03-23"),
    ("2022 rate shock", "2022-01-03", "2022-10-12"),
    ("March 2023 bank stress", "2023-03-08", "2023-03-17"),
    ("August 2024 volatility spike", "2024-07-31", "2024-08-07"),
)
_COVERAGE_SLACK = pd.Timedelta(days=4)


def compute_risk(
    daily_pnl: pd.Series,
    confidences: Sequence[float] = CONFIDENCES,
    horizon: int = HORIZON_DAYS,
    n_sims: int = N_SIMS,
    window: int = VAR_WINDOW,
    seed: int = SEED,
) -> Optional[dict]:
    """Risk report for a daily-return series, or None when there is too little history."""
    pnl = _prepare(daily_pnl)
    n = len(pnl)
    if n < MIN_OBS:
        return None
    x = pnl.to_numpy()
    dates = pnl.index
    mu = float(x.mean())
    sigma = float(x.std(ddof=1))
    if sigma < 1e-12:
        return None

    rng = np.random.default_rng(seed)
    df, loc, scale = fit_student_t(x)
    draws = np.maximum(loc + scale * rng.standard_t(df, size=(n_sims, horizon)), -0.99)
    one_day = draws[:, 0]
    horizon_paths = np.prod(1.0 + draws, axis=1) - 1.0
    idx = rng.integers(0, n, size=(n_sims, horizon))
    bootstrap_paths = np.prod(1.0 + x[idx], axis=1) - 1.0

    var_rows, cvar_rows, hz_var_rows, hz_cvar_rows = [], [], [], []
    for c in confidences:
        hist = historical_var_cvar(x, c)
        gauss = gaussian_var_cvar(mu, sigma, c)
        mc = historical_var_cvar(one_day, c)
        var_rows.append(_row(c, historical=hist[0], gaussian=gauss[0], monte_carlo=mc[0]))
        cvar_rows.append(_row(c, historical=hist[1], gaussian=gauss[1], monte_carlo=mc[1]))

        hz_gauss = gaussian_var_cvar(mu, sigma, c, horizon)
        hz_boot = historical_var_cvar(bootstrap_paths, c)
        hz_mc = historical_var_cvar(horizon_paths, c)
        hz_var_rows.append(_row(c, gaussian=hz_gauss[0], bootstrap=hz_boot[0], monte_carlo=hz_mc[0]))
        hz_cvar_rows.append(_row(c, gaussian=hz_gauss[1], bootstrap=hz_boot[1], monte_carlo=hz_mc[1]))

    win = window if n >= window + MIN_OBS else max(MIN_BACKTEST_DAYS, n // 2)
    backtest, series = ([], [])
    if n - win >= MIN_BACKTEST_DAYS:
        backtest, series = _var_backtest(x, dates, confidences, win)

    return {
        "n_obs": n,
        "distribution": {
            "mean": _r(mu),
            "std": _r(sigma),
            "annual_vol": _r(sigma * np.sqrt(252)),
            "skew": _r(stats.skew(x, bias=False), 3),
            "excess_kurtosis": _r(stats.kurtosis(x, bias=False), 3),
            "worst_day": _r(x.min()),
            "best_day": _r(x.max()),
            "t_df": _r(df, 2),
        },
        "var": var_rows,
        "cvar": cvar_rows,
        "horizon": {"days": horizon, "var": hz_var_rows, "cvar": hz_cvar_rows},
        "backtest": backtest,
        "series": series,
        "stress": {
            "worst_stretches": _worst_stretches(x, dates),
            "windows": _stress_windows(x, dates),
            "vol_shocks": _vol_shocks(x, max(confidences)),
        },
    }


# ── VaR and CVaR estimators ─────────────────────────────────────────────────


def historical_var_cvar(sample: np.ndarray, confidence: float) -> tuple[float, float]:
    """VaR and CVaR from the empirical distribution. Both are positive losses."""
    q = np.quantile(sample, 1.0 - confidence)
    return float(-q), float(-sample[sample <= q].mean())


def gaussian_var_cvar(mu: float, sigma: float, confidence: float, horizon: int = 1) -> tuple[float, float]:
    """Normal-distribution VaR and CVaR, scaled to the horizon by compounding i.i.d. days."""
    alpha = 1.0 - confidence
    z = stats.norm.ppf(alpha)
    mu_h, sigma_h = mu * horizon, sigma * np.sqrt(horizon)
    var = -(mu_h + sigma_h * z)
    cvar = -(mu_h - sigma_h * stats.norm.pdf(z) / alpha)
    return float(var), float(cvar)


def fit_student_t(x: np.ndarray) -> tuple[float, float, float]:
    """Maximum-likelihood Student-t fit; returns (df, loc, scale) with df kept in a sane range."""
    df, loc, scale = stats.t.fit(x)
    lo, hi = T_DF_BOUNDS
    clipped = float(np.clip(df, lo, hi))
    if clipped != df:
        _, loc, scale = stats.t.fit(x, fdf=clipped)
    return clipped, float(loc), float(scale)


# ── VaR backtest ────────────────────────────────────────────────────────────


def kupiec_pof(observations: int, exceptions: int, p: float) -> tuple[float, float]:
    """Kupiec proportion-of-failures test. Returns (LR statistic, p-value) against H0: rate = p."""
    t, k = observations, exceptions
    ll_null = xlogy(t - k, 1.0 - p) + xlogy(k, p)
    pi = k / t
    ll_alt = xlogy(t - k, 1.0 - pi) + xlogy(k, pi)
    lr = max(0.0, float(-2.0 * (ll_null - ll_alt)))
    return lr, float(stats.chi2.sf(lr, 1))


def christoffersen_independence(hits: np.ndarray) -> tuple[float, float]:
    """Christoffersen independence test: are exceptions clustered? Returns (LR, p-value)."""
    prev, cur = hits[:-1], hits[1:]
    n00 = int(np.sum(~prev & ~cur))
    n01 = int(np.sum(~prev & cur))
    n10 = int(np.sum(prev & ~cur))
    n11 = int(np.sum(prev & cur))
    n0, n1 = n00 + n01, n10 + n11
    if n0 + n1 == 0:
        return 0.0, 1.0
    pi = (n01 + n11) / (n0 + n1)
    pi01 = n01 / n0 if n0 else 0.0
    pi11 = n11 / n1 if n1 else 0.0
    ll_null = xlogy(n00 + n10, 1.0 - pi) + xlogy(n01 + n11, pi)
    ll_alt = xlogy(n00, 1.0 - pi01) + xlogy(n01, pi01) + xlogy(n10, 1.0 - pi11) + xlogy(n11, pi11)
    lr = max(0.0, float(-2.0 * (ll_null - ll_alt)))
    return lr, float(stats.chi2.sf(lr, 1))


def _var_backtest(
    x: np.ndarray, dates: pd.DatetimeIndex, confidences: Sequence[float], window: int
) -> tuple[list[dict], list[dict]]:
    """
    Roll a historical VaR forward one day at a time. Each day's forecast uses only the
    `window` days before it, so a breach is a genuine out-of-sample miss.
    """
    history = sliding_window_view(x, window)[:-1]  # row i holds the window ending the day before day window+i
    realized = x[window:]
    forecast_days = len(realized)

    rows: list[dict] = []
    series = {"date": [str(d.date()) for d in dates[window:]], "pnl": realized}
    for c in confidences:
        var_t = -np.quantile(history, 1.0 - c, axis=1)
        hits = realized < -var_t
        k = int(hits.sum())
        p = 1.0 - c
        _, kupiec_p = kupiec_pof(forecast_days, k, p)
        _, indep_p = christoffersen_independence(hits)
        if kupiec_p < SIGNIFICANCE:
            verdict = "too_many" if k / forecast_days > p else "too_few"
        elif indep_p < SIGNIFICANCE:
            verdict = "clustered"
        else:
            verdict = "pass"
        rows.append(
            {
                "confidence": c,
                "window": window,
                "observations": forecast_days,
                "expected": round(forecast_days * p, 1),
                "exceptions": k,
                "rate": _r(k / forecast_days, 4),
                "kupiec_p": _r(kupiec_p, 4),
                "independence_p": _r(indep_p, 4),
                "verdict": verdict,
            }
        )
        series[_var_key(c)] = var_t

    points = [
        {
            "date": series["date"][i],
            "pnl": _r(series["pnl"][i]),
            **{_var_key(c): _r(series[_var_key(c)][i]) for c in confidences},
        }
        for i in range(forecast_days)
    ]
    return rows, points


def _var_key(confidence: float) -> str:
    return f"var{int(round(confidence * 100))}"


# ── Stress ──────────────────────────────────────────────────────────────────


def _worst_stretches(x: np.ndarray, dates: pd.DatetimeIndex) -> list[dict]:
    """Worst compounded return over every rolling 1, 5, 20 and 60 day stretch."""
    cum = np.concatenate([[0.0], np.cumsum(np.log1p(np.maximum(x, -0.999999)))])
    out = []
    for k in STRETCH_DAYS:
        if len(x) < k:
            continue
        rets = np.expm1(cum[k:] - cum[:-k])
        i = int(np.argmin(rets))
        out.append(
            {"days": k, "return": _r(rets[i]), "start": str(dates[i].date()), "end": str(dates[i + k - 1].date())}
        )
    return out


def _stress_windows(x: np.ndarray, dates: pd.DatetimeIndex) -> list[dict]:
    """How the strategy did inside known market-stress windows the backtest period covers."""
    out = []
    for name, start, end in STRESS_WINDOWS:
        s, e = pd.Timestamp(start), pd.Timestamp(end)
        if dates[0] > s + _COVERAGE_SLACK or dates[-1] < e - _COVERAGE_SLACK:
            continue
        inside = (dates >= s) & (dates <= e)
        if inside.sum() < 3:
            continue
        out.append(
            {"name": name, "start": start, "end": end, "days": int(inside.sum()), "return": _r(np.prod(1.0 + x[inside]) - 1.0)}
        )
    return out


def _vol_shocks(x: np.ndarray, confidence: float) -> list[dict]:
    """VaR and CVaR if volatility were a multiple of what the backtest saw, with the mean unchanged."""
    mu = x.mean()
    out = []
    for m in VOL_SHOCKS:
        var, cvar = historical_var_cvar(mu + m * (x - mu), confidence)
        out.append({"multiple": m, "confidence": confidence, "var": _r(var), "cvar": _r(cvar)})
    return out


# ── Helpers ─────────────────────────────────────────────────────────────────


def _prepare(daily_pnl: pd.Series) -> pd.Series:
    """Finite daily returns from the first day the book actually held positions."""
    pnl = pd.Series(daily_pnl).astype(float).replace([np.inf, -np.inf], np.nan).dropna()
    pnl.index = pd.DatetimeIndex(pnl.index)
    # Before the first signal the book is empty and P&L is exactly zero. Those days carry no risk.
    traded = pnl.ne(0.0).to_numpy()
    if not traded.any():
        return pnl.iloc[0:0]
    return pnl.iloc[int(np.argmax(traded)) :]


def _row(confidence: float, **values: float) -> dict:
    return {"confidence": confidence, **{k: _r(v) for k, v in values.items()}}


def _r(v: float, digits: int = 5) -> float:
    return round(float(v), digits)
