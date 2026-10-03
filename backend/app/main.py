"""FastAPI application — Alpha research platform backend."""

import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    ExpressionBacktestRequest,
    MLBacktestRequest,
    BacktestResponse,
    MLBacktestResponse,
    FeatureInfo,
    UniverseInfo,
)
from .data.fetcher import fetch_price_data, get_available_features
from .data.universe import get_universe, UNIVERSES
from .engine.alpha_dsl import AlphaDSLEvaluator
from .engine.backtest import run_backtest
from .ml.features import build_feature_matrix, FEATURE_CATEGORIES, ALL_FEATURES
from .ml.pipeline import run_ml_backtest
from .routes.worldquant import router as wq_router
from .routes.coach import router as coach_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Alpha platform starting up")
    yield
    logger.info("Alpha platform shutting down")


app = FastAPI(
    title="AlphaGen API",
    description="WorldQuant/Numerai-style cross-sectional alpha research platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Only the site itself (plus local dev and Vercel previews) may call the API.
# Override with a comma-separated ALLOWED_ORIGINS env var, e.g. on Railway.
_DEFAULT_ORIGINS = "https://quant.drew.fun,https://lavaquant.drew.fun,https://drew.fun,http://localhost:3000,http://127.0.0.1:3000"
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", _DEFAULT_ORIGINS).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://[a-z0-9-]+\.vercel\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(wq_router)
app.include_router(coach_router)


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": time.time()}


@app.get("/api/universe")
async def list_universes() -> list[UniverseInfo]:
    return [
        UniverseInfo(name=name, tickers=tickers[:10], count=len(tickers))
        for name, tickers in UNIVERSES.items()
    ]


@app.get("/api/features")
async def list_features() -> list[FeatureInfo]:
    descriptions = {
        "mom_5d": "5-day price momentum", "mom_21d": "1-month momentum",
        "mom_63d": "3-month momentum", "mom_126d": "6-month momentum",
        "mom_252d": "12-month momentum", "reversal_1d": "1-day reversal",
        "reversal_5d": "5-day reversal", "vol_5d": "5-day realized volatility",
        "vol_21d": "21-day realized volatility", "vol_63d": "63-day realized volatility",
        "vol_ratio_5_21": "Short/long vol ratio", "vol_ratio_5d": "Volume vs 5d avg",
        "vol_ratio_21d": "Volume vs 21d avg", "vol_trend": "Volume trend 5d/21d",
        "pct_from_52w_high": "Distance from 52-week high",
        "pct_from_52w_low": "Distance from 52-week low",
        "price_to_vwap": "Price vs VWAP", "bb_pos_20d": "Bollinger Band position",
        "rsi_14": "RSI (14-day)", "rsi_28": "RSI (28-day)",
        "macd_hist": "MACD histogram", "range_pct": "Intraday range %",
        "range_5d": "5-day avg range", "autocorr_5": "5-day autocorrelation",
    }
    result = []
    for category, feats in FEATURE_CATEGORIES.items():
        for f in feats:
            result.append(FeatureInfo(
                name=f,
                category=category,
                description=descriptions.get(f, f),
            ))
    return result


@app.get("/api/dsl/operators")
async def list_operators() -> dict[str, Any]:
    return {
        "cross_sectional": [
            {"name": "rank", "signature": "rank(x)", "description": "Cross-sectional percentile rank → [-1, 1]"},
            {"name": "zscore", "signature": "zscore(x)", "description": "Cross-sectional z-score"},
            {"name": "demean", "signature": "demean(x)", "description": "Subtract cross-sectional mean"},
            {"name": "winsorize", "signature": "winsorize(x, pct)", "description": "Clip top/bottom pct outliers (default 5%)"},
        ],
        "time_series": [
            {"name": "ts_mean", "signature": "ts_mean(x, d)", "description": "d-day rolling mean per asset"},
            {"name": "ts_std", "signature": "ts_std(x, d)", "description": "d-day rolling std per asset"},
            {"name": "ts_sum", "signature": "ts_sum(x, d)", "description": "d-day rolling sum per asset"},
            {"name": "ts_max", "signature": "ts_max(x, d)", "description": "Highest value in the past d days per asset"},
            {"name": "ts_min", "signature": "ts_min(x, d)", "description": "Lowest value in the past d days per asset"},
            {"name": "ts_delta", "signature": "ts_delta(x, d)", "description": "x(t) - x(t-d)"},
            {"name": "ts_delay", "signature": "ts_delay(x, d)", "description": "x(t-d)"},
            {"name": "ts_rank", "signature": "ts_rank(x, d)", "description": "Rank of today within past d days per asset"},
            {"name": "ts_corr", "signature": "ts_corr(x, y, d)", "description": "d-day rolling correlation between x and y per asset"},
            {"name": "ts_decay_linear", "signature": "ts_decay_linear(x, d)", "description": "Linearly-weighted moving avg (recent = high weight)"},
            {"name": "ts_autocorr", "signature": "ts_autocorr(x, lag, window)", "description": "Rolling autocorrelation"},
        ],
        "group": [
            {"name": "group_rank", "signature": "group_rank(x, group)", "description": "Cross-sectional rank within group/sector"},
            {"name": "group_zscore", "signature": "group_zscore(x, group)", "description": "Z-score within group/sector"},
            {"name": "group_neutralize", "signature": "group_neutralize(x, group)", "description": "Subtract group mean (sector-neutral)"},
        ],
        "element_wise": [
            {"name": "log", "signature": "log(x)", "description": "Natural log"},
            {"name": "abs", "signature": "abs(x)", "description": "Absolute value"},
            {"name": "sign", "signature": "sign(x)", "description": "Sign (-1, 0, 1)"},
            {"name": "sqrt", "signature": "sqrt(x)", "description": "Square root of abs(x)"},
            {"name": "power", "signature": "power(x, n)", "description": "x^n"},
            {"name": "max", "signature": "max(x, y)", "description": "Larger of x and y, element-wise"},
            {"name": "min", "signature": "min(x, y)", "description": "Smaller of x and y, element-wise"},
            {"name": "clamp", "signature": "clamp(x, lo, hi)", "description": "Clip to [lo, hi]"},
        ],
        "data_fields": [
            "close", "open", "high", "low", "volume",
            "returns", "log_returns", "vwap", "range", "gap",
            "volume_ratio", "sector", "cap",
        ],
        "example_alphas": [
            {"name": "Short-Term Reversal", "expression": "rank(-ts_delta(close, 5))", "description": "Short-term price reversal signal"},
            {"name": "Volume-Price Divergence", "expression": "rank(ts_corr(returns, volume, 20)) * -1", "description": "Short when price and volume move together"},
            {"name": "Vol-Adjusted Reversal", "expression": "rank(-ts_mean(returns, 5)) * rank(ts_std(returns, 20))", "description": "Reversal scaled by recent volatility"},
            {"name": "Sector-Neutral Reversal", "expression": "group_neutralize(rank(-returns), sector)", "description": "1-day reversal, neutralized by sector"},
            {"name": "Decay-Weighted Momentum", "expression": "rank(ts_decay_linear(returns, 10)) - rank(ts_std(returns, 20))", "description": "Recent momentum minus volatility penalty"},
            {"name": "Volume Breakout", "expression": "rank(-ts_corr(close, volume, 10)) + rank(ts_delta(volume, 5))", "description": "Price-volume divergence plus volume surge"},
        ],
    }


@app.post("/api/backtest/expression")
async def backtest_expression(req: ExpressionBacktestRequest) -> dict:
    """Run a cross-sectional alpha expression backtest."""
    t0 = time.time()
    try:
        data = fetch_price_data(req.universe, req.start_date, req.end_date)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Data fetch failed: {e}")

    try:
        evaluator = AlphaDSLEvaluator(data)
        alpha = evaluator.eval(req.expression)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Expression error: {e}")

    if alpha is None or (hasattr(alpha, "empty") and alpha.empty):
        raise HTTPException(status_code=400, detail="Alpha expression returned empty result")

    returns = data["returns"]
    sector = data.get("sector")

    result = run_backtest(
        alpha=alpha,
        returns=returns,
        forward_days=req.forward_days,
        long_short_pct=req.long_short_pct,
        sector_neutral=req.sector_neutral,
        sector=sector,
    )

    result["elapsed_seconds"] = round(time.time() - t0, 2)
    result["expression"] = req.expression
    return result


@app.post("/api/backtest/ml")
async def backtest_ml(req: MLBacktestRequest) -> dict:
    """Run an ML-based factor model backtest."""
    t0 = time.time()
    try:
        data = fetch_price_data(req.universe, req.start_date, req.end_date)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Data fetch failed: {e}")

    all_features = build_feature_matrix(data)
    invalid = [f for f in req.features if f not in all_features]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown features: {invalid}")

    try:
        result = run_ml_backtest(
            features=all_features,
            returns=data["returns"],
            selected_features=req.features,
            model_type=req.model_type,
            forward_days=req.forward_days,
            n_folds=req.n_folds,
            embargo_days=req.embargo_days,
        )
    except Exception as e:
        logger.exception("ML backtest failed")
        raise HTTPException(status_code=500, detail=str(e))

    result["elapsed_seconds"] = round(time.time() - t0, 2)
    return result
