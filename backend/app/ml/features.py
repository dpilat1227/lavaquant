"""
Standard feature engineering for the ML pipeline.
All features derived from OHLCV data — no external data needed.
"""

import numpy as np
import pandas as pd


def build_feature_matrix(data: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    """
    Build a library of ML features from raw price data.
    Returns dict of {feature_name: DataFrame(dates × assets)}.
    """
    close = data["close"]
    high = data["high"]
    low = data["low"]
    volume = data["volume"]
    returns = data["returns"]
    vwap = data.get("vwap", (close + high + low) / 3)

    features: dict[str, pd.DataFrame] = {}

    # ── Momentum ──────────────────────────────────────────────────────────────
    for d in [5, 10, 21, 63, 126, 252]:
        features[f"mom_{d}d"] = returns.rolling(d).sum()

    # Short-term reversal
    features["reversal_1d"] = -returns
    features["reversal_5d"] = -returns.rolling(5).sum()

    # ── Volatility ────────────────────────────────────────────────────────────
    for d in [5, 10, 21, 63]:
        features[f"vol_{d}d"] = returns.rolling(d).std()

    # Realized vol ratio (short vs long)
    features["vol_ratio_5_21"] = features["vol_5d"] / features["vol_21d"].replace(0, np.nan)

    # ── Volume ────────────────────────────────────────────────────────────────
    vol_ma = {d: volume.rolling(d).mean() for d in [5, 21]}
    features["vol_ratio_5d"] = volume / vol_ma[5].replace(0, np.nan)
    features["vol_ratio_21d"] = volume / vol_ma[21].replace(0, np.nan)
    features["vol_trend"] = vol_ma[5] / vol_ma[21].replace(0, np.nan)

    # ── Price level / technical ───────────────────────────────────────────────
    # Distance from 52-week high/low
    high_52w = close.rolling(252).max()
    low_52w = close.rolling(252).min()
    features["pct_from_52w_high"] = (close - high_52w) / high_52w.replace(0, np.nan)
    features["pct_from_52w_low"] = (close - low_52w) / low_52w.replace(0, np.nan)

    # VWAP ratio
    features["price_to_vwap"] = close / vwap.replace(0, np.nan) - 1

    # Bollinger Band position
    for d in [20]:
        ma = close.rolling(d).mean()
        std = close.rolling(d).std()
        bb_upper = ma + 2 * std
        bb_lower = ma - 2 * std
        features[f"bb_pos_{d}d"] = (close - bb_lower) / (bb_upper - bb_lower).replace(0, np.nan)

    # RSI
    features["rsi_14"] = _compute_rsi(returns, 14)
    features["rsi_28"] = _compute_rsi(returns, 28)

    # MACD signal
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    features["macd_hist"] = macd - signal

    # ── Range / intraday ─────────────────────────────────────────────────────
    daily_range = (high - low) / close.shift(1).replace(0, np.nan)
    features["range_pct"] = daily_range
    features["range_5d"] = daily_range.rolling(5).mean()

    # ── Trend / autocorrelation ───────────────────────────────────────────────
    features["autocorr_5"] = returns.rolling(21).apply(
        lambda x: pd.Series(x).autocorr(lag=5) if len(x) > 5 else np.nan, raw=False
    )

    return features


def _compute_rsi(returns: pd.DataFrame, window: int) -> pd.DataFrame:
    gains = returns.clip(lower=0)
    losses = (-returns).clip(lower=0)
    avg_gain = gains.ewm(alpha=1 / window, adjust=False).mean()
    avg_loss = losses.ewm(alpha=1 / window, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


FEATURE_CATEGORIES = {
    "Momentum": [f"mom_{d}d" for d in [5, 10, 21, 63, 126, 252]],
    "Reversal": ["reversal_1d", "reversal_5d"],
    "Volatility": [f"vol_{d}d" for d in [5, 10, 21, 63]] + ["vol_ratio_5_21"],
    "Volume": ["vol_ratio_5d", "vol_ratio_21d", "vol_trend"],
    "Technical": [
        "pct_from_52w_high", "pct_from_52w_low", "price_to_vwap",
        "bb_pos_20d", "rsi_14", "rsi_28", "macd_hist",
    ],
    "Range": ["range_pct", "range_5d"],
    "Autocorrelation": ["autocorr_5"],
}

ALL_FEATURES = [f for feats in FEATURE_CATEGORIES.values() for f in feats]
