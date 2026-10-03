"""Point-in-time company fundamentals from SEC EDGAR, aligned to the price grid.

The data file is built offline by scripts/build_fundamentals.py. Every number is stamped with the day its filing
became public, and is only visible to the backtest from the next trading day on, so there is no lookahead.
"""
from __future__ import annotations

import gzip
import json
import re
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

DATA_FILE = Path(__file__).with_name("fundamentals.json.gz")

RAW_FIELDS = ["sales", "net_income", "operating_income", "cashflow_op", "equity", "assets", "liabilities", "shares_out"]
DERIVED_FIELDS = [
    "mktcap", "book_to_market", "earnings_yield", "sales_to_price", "cashflow_yield",
    "roe", "roa", "op_margin", "leverage",
]
FUNDAMENTAL_FIELDS = set(RAW_FIELDS) | set(DERIVED_FIELDS)


@lru_cache(maxsize=1)
def _load() -> dict:
    with gzip.open(DATA_FILE, "rt") as f:
        return json.load(f)


def used_fields(expression: str) -> set[str]:
    return FUNDAMENTAL_FIELDS & set(re.findall(r"[A-Za-z_]\w*", expression))


def _align(points: list[list], index: pd.DatetimeIndex) -> pd.Series:
    """Step-function of filing values onto trading days, visible from the day after filing."""
    s = pd.Series(np.nan, index=index)
    if not points:
        return s
    filed = pd.DatetimeIndex([p[0] for p in points])
    pos = index.searchsorted(filed, side="right")  # first trading day strictly after the filing date
    for p, i in zip(points, pos):
        if i < len(index):
            s.iloc[i] = p[1]
    return s.ffill()


def build_fields(data: dict[str, pd.DataFrame], wanted: set[str]) -> dict[str, pd.DataFrame]:
    """Return the fundamental DataFrames the expression asks for (dates x tickers, same grid as close)."""
    close = data["close"]
    tickers = _load()["tickers"]
    index = pd.DatetimeIndex(close.index)

    need_raw = set(RAW_FIELDS) if wanted & set(DERIVED_FIELDS) else (wanted & set(RAW_FIELDS))
    raw: dict[str, pd.DataFrame] = {}
    for name in need_raw:
        cols = {}
        for t in close.columns:
            pts = tickers.get(str(t), {}).get(name)
            cols[t] = _align(pts or [], index)
        raw[name] = pd.DataFrame(cols, index=close.index)

    if "shares_out" in raw:
        # filings report shares as of their own date; prices here are split-adjusted, so scale by later splits
        for t in close.columns:
            splits = tickers.get(str(t), {}).get("splits") or []
            if not splits:
                continue
            factor = pd.Series(1.0, index=index)
            for date, ratio in splits:
                factor[index < pd.Timestamp(date)] *= ratio
            raw["shares_out"][t] = raw["shares_out"][t] * factor

    out: dict[str, pd.DataFrame] = dict(raw)
    if wanted & set(DERIVED_FIELDS):
        mktcap = close * raw["shares_out"]
        out["mktcap"] = mktcap
        equity = raw["equity"]
        derived = {
            "book_to_market": equity / mktcap,
            "earnings_yield": raw["net_income"] / mktcap,
            "sales_to_price": raw["sales"] / mktcap,
            "cashflow_yield": raw["cashflow_op"] / mktcap,
            "roe": raw["net_income"] / equity.where(equity > 0),
            "roa": raw["net_income"] / raw["assets"],
            "op_margin": raw["operating_income"] / raw["sales"],
            "leverage": raw["liabilities"] / raw["assets"],
        }
        for k, v in derived.items():
            out[k] = v.replace([np.inf, -np.inf], np.nan)
    result = {k: v for k, v in out.items() if k in wanted}
    if any(not v.notna().any().any() for v in result.values()):
        raise ValueError("No fundamentals for this universe. They cover US stocks only (not ETFs, forex or commodities).")
    return result
