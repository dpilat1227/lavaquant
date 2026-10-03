"""yfinance-based data fetcher with parquet caching."""
from __future__ import annotations

import os
import time
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import yfinance as yf

from .universe import get_universe, get_sector

logger = logging.getLogger(__name__)

CACHE_DIR = Path(os.getenv("CACHE_DIR", "/tmp/alphagen_cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

OHLCV_FIELDS = ["Open", "High", "Low", "Close", "Volume"]


def _cache_key(tickers: list[str], start: str, end: str) -> str:
    key = f"{'_'.join(sorted(tickers))}_{start}_{end}"
    return hashlib.md5(key.encode()).hexdigest()[:12]


def _is_cache_fresh(path: Path, max_age_hours: int = 12) -> bool:
    if not path.exists():
        return False
    age = datetime.now() - datetime.fromtimestamp(path.stat().st_mtime)
    return age < timedelta(hours=max_age_hours)


# A cached or downloaded frame must cover most of the requested universe to be trusted.
MIN_TICKER_SHARE_TO_CACHE = 0.9
MIN_TICKER_SHARE_TO_USE = 0.5
MIN_TICKERS_TO_USE = 10


def _close_frame(raw: pd.DataFrame, tickers: list[str]) -> pd.DataFrame:
    if isinstance(raw.columns, pd.MultiIndex):
        close = raw["Close"] if "Close" in raw.columns.get_level_values(0) else pd.DataFrame(index=raw.index)
    else:
        close = raw[["Close"]] if "Close" in raw.columns else pd.DataFrame(index=raw.index)
    return close.reindex(columns=tickers)


def _good_tickers(raw: pd.DataFrame, tickers: list[str]) -> list[str]:
    """Tickers with at least 70% of their price history present."""
    share = _close_frame(raw, tickers).notna().mean()
    return [t for t in tickers if float(share.get(t, 0.0)) >= 0.7]


def _download(tickers: list[str], start: str, end: str, threads: bool) -> pd.DataFrame:
    raw = yf.download(tickers, start=start, end=end, auto_adjust=True, progress=False, threads=threads)
    if not raw.empty and not isinstance(raw.columns, pd.MultiIndex):
        raw.columns = pd.MultiIndex.from_product([raw.columns, tickers[:1]])
    return raw


def _download_with_retries(tickers: list[str], start: str, end: str) -> pd.DataFrame:
    """Bulk download, then re-fetch any tickers Yahoo skipped in small sequential batches."""
    raw = _download(tickers, start, end, threads=True)
    good = _good_tickers(raw, tickers) if not raw.empty else []
    for _ in range(2):
        missing = [t for t in tickers if t not in good]
        if not missing:
            break
        time.sleep(1.5)
        parts = []
        for i in range(0, len(missing), 20):
            chunk = missing[i : i + 20]
            try:
                part = _download(chunk, start, end, threads=False)
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Retry batch failed: {e}")
                continue
            if not part.empty:
                parts.append(part)
            time.sleep(0.5)
        if parts:
            keep = raw.loc[:, raw.columns.get_level_values(1).isin(good)] if not raw.empty else raw
            raw = pd.concat([keep, *parts], axis=1) if not keep.empty else pd.concat(parts, axis=1)
            good = _good_tickers(raw, tickers)
    return raw


def fetch_price_data(
    universe: str,
    start_date: str,
    end_date: str,
    max_tickers: int = 100,
) -> dict[str, pd.DataFrame]:
    """
    Returns dict of {field: DataFrame(index=dates, columns=tickers)}.
    Fields: open, high, low, close, volume, returns, log_returns, vwap
    """
    tickers = get_universe(universe)[:max_tickers]
    cache_key = _cache_key(tickers, start_date, end_date)
    cache_path = CACHE_DIR / f"{cache_key}.parquet"

    raw = None
    if _is_cache_fresh(cache_path):
        cached = pd.read_parquet(cache_path)
        if len(_good_tickers(cached, tickers)) >= MIN_TICKER_SHARE_TO_CACHE * len(tickers):
            logger.info(f"Cache hit: {cache_path}")
            raw = cached
        else:
            logger.warning(f"Discarding incomplete cache {cache_path}")
            cache_path.unlink(missing_ok=True)

    if raw is None:
        logger.info(f"Fetching {len(tickers)} tickers from {start_date} to {end_date}")
        raw = _download_with_retries(tickers, start_date, end_date)
        if raw.empty:
            raise ValueError("No data returned from yfinance")
        n_good = len(_good_tickers(raw, tickers))
        if n_good < max(MIN_TICKERS_TO_USE, MIN_TICKER_SHARE_TO_USE * len(tickers)):
            raise ValueError(
                f"Yahoo Finance returned usable data for only {n_good} of {len(tickers)} tickers "
                f"for {start_date} to {end_date}. It may be rate limiting this server; try again in a minute."
            )
        if n_good >= MIN_TICKER_SHARE_TO_CACHE * len(tickers):
            raw.to_parquet(cache_path)
        else:
            logger.warning(f"Partial data ({n_good}/{len(tickers)} tickers); not caching")

    return _build_feature_matrices(raw, tickers)


def _build_feature_matrices(raw: pd.DataFrame, tickers: list[str]) -> dict[str, pd.DataFrame]:
    """Convert yfinance MultiIndex DataFrame into feature matrices."""
    data: dict[str, pd.DataFrame] = {}

    def _get_field(field: str) -> pd.DataFrame:
        if isinstance(raw.columns, pd.MultiIndex):
            try:
                df = raw[field]
            except KeyError:
                return pd.DataFrame()
        else:
            df = raw[[field]].copy()
        if isinstance(df, pd.Series):
            df = df.to_frame()
        df = df.reindex(columns=tickers)
        return df.astype(float)

    close = _get_field("Close")
    open_ = _get_field("Open")
    high = _get_field("High")
    low = _get_field("Low")
    volume = _get_field("Volume")

    # Drop tickers with >30% missing data
    keep = close.isnull().mean() < 0.30
    tickers_valid = close.columns[keep].tolist()
    close = close[tickers_valid]
    open_ = open_[tickers_valid]
    high = high[tickers_valid]
    low = low[tickers_valid]
    volume = volume[tickers_valid]

    # Forward-fill then drop all-NaN rows
    close = close.ffill()
    open_ = open_.ffill()
    high = high.ffill()
    low = low.ffill()
    volume = volume.fillna(0)

    data["close"] = close
    data["open"] = open_
    data["high"] = high
    data["low"] = low
    data["volume"] = volume

    # Derived features
    data["returns"] = close.pct_change()
    data["log_returns"] = np.log(close / close.shift(1))
    data["vwap"] = (close + high + low) / 3

    # Intraday range
    data["range"] = (high - low) / close.shift(1)

    # Gap (open vs prev close)
    data["gap"] = (open_ - close.shift(1)) / close.shift(1)

    # Volume moving averages for normalization
    vol_ma20 = volume.rolling(20).mean()
    data["volume_ratio"] = volume / vol_ma20.replace(0, np.nan)

    # Sector codes (numeric) for grouping
    sector_codes = {}
    for t in tickers_valid:
        sector = get_sector(t)
        sector_codes[t] = sector
    sector_series = pd.Series(sector_codes)
    sectors_unique = sector_series.unique()
    sector_int = sector_series.map({s: i for i, s in enumerate(sectors_unique)})
    data["sector"] = pd.DataFrame(
        np.tile(sector_int.values, (len(close), 1)),
        index=close.index,
        columns=tickers_valid,
    )

    # Market cap proxy (price * volume as rough proxy)
    data["cap"] = close * volume

    return data


def get_available_features() -> list[str]:
    return [
        "close", "open", "high", "low", "volume",
        "returns", "log_returns", "vwap", "range", "gap",
        "volume_ratio", "sector", "cap",
    ]
