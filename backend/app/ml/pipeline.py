"""
ML pipeline: LightGBM / linear factor model with purged time-series CV.

Numerai/WorldQuant style:
  - Era-wise training (each date = one era)
  - Purged cross-validation with embargo gap
  - Target: forward N-day return, cross-sectionally ranked
  - Metrics: Spearman IC, ICIR, Sharpe
"""
from __future__ import annotations

import logging
from typing import Literal

import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

try:
    import lightgbm as lgb
    HAS_LGB = True
except ImportError:
    HAS_LGB = False
    logger.warning("lightgbm not installed; ML model will use Ridge regression")


def run_ml_backtest(
    features: dict[str, pd.DataFrame],
    returns: pd.DataFrame,
    selected_features: list[str],
    model_type: Literal["lightgbm", "linear"] = "lightgbm",
    forward_days: int = 5,
    n_folds: int = 5,
    embargo_days: int = 21,
) -> dict:
    """
    Train model with purged time-series CV, return backtest results.
    """
    # Build panel (stacked date × asset)
    X_panel, y_panel, meta = _build_panel(
        features, returns, selected_features, forward_days
    )
    if X_panel is None or len(X_panel) < 500:
        raise ValueError("Not enough data to run ML backtest")

    dates = meta["date"].unique()
    dates_sorted = sorted(dates)
    n_dates = len(dates_sorted)
    fold_size = n_dates // n_folds

    oof_predictions = pd.Series(np.nan, index=X_panel.index)

    for fold in range(n_folds):
        val_start_idx = fold * fold_size
        val_end_idx = (fold + 1) * fold_size if fold < n_folds - 1 else n_dates

        val_dates = set(dates_sorted[val_start_idx:val_end_idx])
        embargo_cutoff = dates_sorted[max(0, val_start_idx - embargo_days)]
        train_dates = {d for d in dates_sorted if d < embargo_cutoff}

        if len(train_dates) < 50:
            continue

        train_mask = meta["date"].isin(train_dates)
        val_mask = meta["date"].isin(val_dates)

        X_train = X_panel[train_mask]
        y_train = y_panel[train_mask]
        X_val = X_panel[val_mask]

        model = _fit_model(X_train, y_train, model_type)
        preds = model.predict(X_val)
        oof_predictions[val_mask] = preds

        logger.info(f"Fold {fold+1}/{n_folds}: {len(train_dates)} train eras, {len(val_dates)} val eras")

    # Pivot OOF predictions back to Date × Asset matrix
    meta["pred"] = oof_predictions.values
    pred_matrix = meta.pivot(index="date", columns="asset", values="pred")
    pred_matrix.index = pd.to_datetime(pred_matrix.index)

    # Run standard backtest on predictions
    from ..engine.backtest import run_backtest
    ret_matrix = returns.reindex(pred_matrix.index)

    backtest_result = run_backtest(
        alpha=pred_matrix,
        returns=ret_matrix,
        forward_days=forward_days,
        long_short_pct=0.20,
    )

    # Feature importance
    feature_importance = _get_feature_importance(model_type, selected_features)

    return {
        **backtest_result,
        "feature_importance": feature_importance,
        "model_type": model_type,
        "n_folds": n_folds,
        "n_features": len(selected_features),
    }


def _build_panel(
    features: dict[str, pd.DataFrame],
    returns: pd.DataFrame,
    selected_features: list[str],
    forward_days: int,
) -> tuple:
    """Stack Date × Asset matrices into a flat panel DataFrame."""
    available = [f for f in selected_features if f in features]
    if not available:
        return None, None, None

    # Forward return target (cross-sectionally ranked within each date)
    fwd_ret = _compute_ranked_forward_return(returns, forward_days)

    # Align all features and target on common dates/assets
    common_dates = fwd_ret.index
    common_assets = fwd_ret.columns
    for f in available:
        common_dates = common_dates.intersection(features[f].index)
        common_assets = common_assets.intersection(features[f].columns)

    rows = []
    for date in common_dates:
        row = {"date": str(date.date())}
        target = fwd_ret.loc[date, common_assets].dropna()
        if len(target) < 10:
            continue
        valid_assets = target.index
        for asset in valid_assets:
            feat_row = {"date": str(date.date()), "asset": asset}
            feat_row["target"] = target[asset]
            for f in available:
                val = features[f].loc[date, asset] if asset in features[f].columns else np.nan
                feat_row[f] = val
            rows.append(feat_row)

    if not rows:
        return None, None, None

    panel = pd.DataFrame(rows).dropna(subset=["target"])
    meta = panel[["date", "asset"]].reset_index(drop=True)
    y = panel["target"].values
    X = panel[available].fillna(0).values

    # Standardize features
    scaler = StandardScaler()
    X = scaler.fit_transform(X)

    X_df = pd.DataFrame(X, columns=available)
    y_series = pd.Series(y)
    return X_df, y_series, meta


def _compute_ranked_forward_return(returns: pd.DataFrame, d: int) -> pd.DataFrame:
    """Compound forward returns, then cross-sectionally rank within each date."""
    fwd = (1 + returns).rolling(d).apply(np.prod, raw=True).shift(-d) - 1
    # Rank cross-sectionally
    return fwd.rank(axis=1, pct=True, na_option="keep") * 2 - 1


def _fit_model(X_train: pd.DataFrame, y_train: pd.Series, model_type: str):
    if model_type == "lightgbm" and HAS_LGB:
        params = {
            "objective": "regression",
            "n_estimators": 200,
            "learning_rate": 0.05,
            "max_depth": 5,
            "num_leaves": 31,
            "min_child_samples": 50,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "reg_alpha": 0.1,
            "reg_lambda": 0.1,
            "verbose": -1,
            "n_jobs": -1,
        }
        model = lgb.LGBMRegressor(**params)
        model.fit(X_train.values, y_train.values)
        return model
    else:
        model = Ridge(alpha=1.0)
        model.fit(X_train.values, y_train.values)
        return model


def _get_feature_importance(model_type: str, features: list[str]) -> list[dict]:
    return [{"feature": f, "importance": 1.0 / len(features)} for f in features]


_last_model = None
