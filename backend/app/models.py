"""Pydantic request/response models."""

from typing import Literal, Optional
from pydantic import BaseModel, Field


class ExpressionBacktestRequest(BaseModel):
    expression: str = Field(..., description="Alpha DSL expression, e.g. rank(-ts_delta(close, 5))")
    universe: Literal["sp500", "sp500_etfs", "etfs", "forex", "commodities"] = "sp500"
    start_date: str = Field("2020-01-01", pattern=r"\d{4}-\d{2}-\d{2}")
    end_date: str = Field("2024-12-31", pattern=r"\d{4}-\d{2}-\d{2}")
    forward_days: int = Field(5, ge=1, le=63)
    long_short_pct: float = Field(0.20, ge=0.05, le=0.49)
    sector_neutral: bool = False


class MLBacktestRequest(BaseModel):
    features: list[str] = Field(..., min_length=1)
    model_type: Literal["lightgbm", "linear"] = "lightgbm"
    universe: Literal["sp500", "sp500_etfs", "etfs", "forex", "commodities"] = "sp500"
    start_date: str = Field("2020-01-01", pattern=r"\d{4}-\d{2}-\d{2}")
    end_date: str = Field("2024-12-31", pattern=r"\d{4}-\d{2}-\d{2}")
    forward_days: int = Field(5, ge=1, le=63)
    n_folds: int = Field(5, ge=3, le=10)
    embargo_days: int = Field(21, ge=5, le=60)


class MetricsResponse(BaseModel):
    annual_return: float
    sharpe: float
    sortino: float
    max_drawdown: float
    ic_mean: float
    ic_std: float
    ic_ir: float
    hit_rate: float
    avg_daily_turnover: float
    n_trading_days: int


class TimeSeriesPoint(BaseModel):
    date: str
    value: Optional[float]


class QuantileReturn(BaseModel):
    quantile: str
    mean_return: float


class BacktestResponse(BaseModel):
    metrics: MetricsResponse
    ic_series: list[TimeSeriesPoint]
    equity_curve: list[TimeSeriesPoint]
    daily_pnl: list[TimeSeriesPoint]
    turnover: list[TimeSeriesPoint]
    quantile_returns: list[QuantileReturn]


class MLBacktestResponse(BacktestResponse):
    feature_importance: list[dict]
    model_type: str
    n_folds: int
    n_features: int


class FeatureInfo(BaseModel):
    name: str
    category: str
    description: str


class UniverseInfo(BaseModel):
    name: str
    tickers: list[str]
    count: int
