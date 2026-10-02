"""
Alpha expression DSL evaluator.

Supports WorldQuant-style operators:
  Cross-sectional: rank, zscore, demean, winsorize
  Time-series:     ts_mean, ts_std, ts_sum, ts_max, ts_min,
                   ts_delta, ts_delay, ts_rank, ts_corr,
                   ts_decay_linear, ts_autocorr
  Group:           group_rank, group_zscore, group_neutralize
  Element-wise:    log, abs, sign, sqrt, power, clamp
  Arithmetic:      +, -, *, /, **

Usage:
    evaluator = AlphaDSLEvaluator(data)
    alpha = evaluator.eval("rank(-ts_delta(close, 5)) * -sign(returns)")
"""
from __future__ import annotations

import ast
import operator
from typing import Union

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

# Type alias for alpha data matrices
Matrix = pd.DataFrame
Scalar = Union[int, float]
Value = Union[Matrix, Scalar]

ALLOWED_FUNCS = {
    # Cross-sectional
    "rank", "zscore", "demean", "winsorize",
    # Time-series
    "ts_mean", "ts_std", "ts_sum", "ts_max", "ts_min",
    "ts_delta", "ts_delay", "ts_rank", "ts_corr",
    "ts_decay_linear", "ts_autocorr",
    # Group
    "group_rank", "group_zscore", "group_neutralize",
    # Element-wise
    "log", "abs", "sign", "sqrt", "power", "clamp",
    "max", "min",
}

SAFE_NAMES = ALLOWED_FUNCS


class AlphaDSLEvaluator:
    def __init__(self, data: dict[str, Matrix]):
        self.data = data

    def eval(self, expr: str) -> Matrix:
        expr = expr.strip()
        try:
            tree = ast.parse(expr, mode="eval")
        except SyntaxError as e:
            raise ValueError(f"Syntax error in alpha expression: {e}")
        return self._eval_node(tree.body)

    def _eval_node(self, node: ast.AST) -> Value:
        if isinstance(node, ast.BinOp):
            return self._eval_binop(node)
        elif isinstance(node, ast.UnaryOp):
            return self._eval_unaryop(node)
        elif isinstance(node, ast.Call):
            return self._eval_call(node)
        elif isinstance(node, ast.Name):
            return self._eval_name(node)
        elif isinstance(node, ast.Constant):
            return node.value
        elif isinstance(node, ast.Num):  # Python < 3.8
            return node.n
        else:
            raise ValueError(f"Unsupported expression node: {type(node).__name__}")

    def _eval_binop(self, node: ast.BinOp) -> Value:
        left = self._eval_node(node.left)
        right = self._eval_node(node.right)
        ops = {
            ast.Add: operator.add,
            ast.Sub: operator.sub,
            ast.Mult: operator.mul,
            ast.Div: operator.truediv,
            ast.Pow: operator.pow,
            ast.Mod: operator.mod,
        }
        op = ops.get(type(node.op))
        if op is None:
            raise ValueError(f"Unsupported operator: {type(node.op).__name__}")
        with np.errstate(divide="ignore", invalid="ignore"):
            result = op(left, right)
        if isinstance(result, pd.DataFrame):
            result = result.replace([np.inf, -np.inf], np.nan)
        return result

    def _eval_unaryop(self, node: ast.UnaryOp) -> Value:
        operand = self._eval_node(node.operand)
        if isinstance(node.op, ast.USub):
            return -operand
        elif isinstance(node.op, ast.UAdd):
            return operand
        elif isinstance(node.op, ast.Not):
            return ~operand
        raise ValueError(f"Unsupported unary op: {type(node.op).__name__}")

    def _eval_name(self, node: ast.Name) -> Value:
        name = node.id
        if name in SAFE_NAMES:
            return name  # function reference, handled in call
        if name in self.data:
            return self.data[name]
        raise ValueError(f"Unknown variable or function: '{name}'")

    def _eval_call(self, node: ast.Call) -> Value:
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        else:
            raise ValueError("Only simple function calls are supported")

        if func_name not in ALLOWED_FUNCS:
            raise ValueError(f"Function '{func_name}' is not allowed in alpha expressions")

        args = [self._eval_node(a) for a in node.args]
        return self._dispatch(func_name, args)

    def _dispatch(self, name: str, args: list) -> Value:
        # Cross-sectional
        if name == "rank":
            return _rank(args[0])
        if name == "zscore":
            return _zscore(args[0])
        if name == "demean":
            return _demean(args[0])
        if name == "winsorize":
            pct = args[1] if len(args) > 1 else 0.05
            return _winsorize(args[0], pct)

        # Time-series
        if name == "ts_mean":
            return _ts_mean(args[0], int(args[1]))
        if name == "ts_std":
            return _ts_std(args[0], int(args[1]))
        if name == "ts_sum":
            return _ts_sum(args[0], int(args[1]))
        if name == "ts_max":
            return _ts_max(args[0], int(args[1]))
        if name == "ts_min":
            return _ts_min(args[0], int(args[1]))
        if name == "ts_delta":
            return _ts_delta(args[0], int(args[1]))
        if name == "ts_delay":
            return _ts_delay(args[0], int(args[1]))
        if name == "ts_rank":
            return _ts_rank(args[0], int(args[1]))
        if name == "ts_corr":
            return _ts_corr(args[0], args[1], int(args[2]))
        if name == "ts_decay_linear":
            return _ts_decay_linear(args[0], int(args[1]))
        if name == "ts_autocorr":
            lag = int(args[1]) if len(args) > 1 else 1
            window = int(args[2]) if len(args) > 2 else 20
            return _ts_autocorr(args[0], lag, window)

        # Group
        if name == "group_rank":
            return _group_rank(args[0], args[1])
        if name == "group_zscore":
            return _group_zscore(args[0], args[1])
        if name == "group_neutralize":
            return _group_neutralize(args[0], args[1])

        # Element-wise
        if name == "log":
            x = args[0]
            with np.errstate(divide="ignore", invalid="ignore"):
                return np.log(x).replace([np.inf, -np.inf], np.nan) if isinstance(x, pd.DataFrame) else np.log(x)
        if name == "abs":
            return args[0].abs() if isinstance(args[0], pd.DataFrame) else abs(args[0])
        if name == "sign":
            return np.sign(args[0])
        if name == "sqrt":
            return np.sqrt(args[0].abs()) if isinstance(args[0], pd.DataFrame) else np.sqrt(abs(args[0]))
        if name == "power":
            return args[0] ** args[1]
        if name == "clamp":
            lo, hi = args[1], args[2]
            return args[0].clip(lower=lo, upper=hi) if isinstance(args[0], pd.DataFrame) else max(lo, min(hi, args[0]))
        if name == "max":
            return args[0].where(args[0] >= args[1], args[1]) if isinstance(args[0], pd.DataFrame) else max(args[0], args[1])
        if name == "min":
            return args[0].where(args[0] <= args[1], args[1]) if isinstance(args[0], pd.DataFrame) else min(args[0], args[1])

        raise ValueError(f"Unknown function: {name}")


# ── Cross-sectional operators ──────────────────────────────────────────────────

def _rank(x: Matrix) -> Matrix:
    """Cross-sectional percentile rank, scaled to [-1, 1]."""
    return x.rank(axis=1, pct=True, na_option="keep") * 2 - 1


def _zscore(x: Matrix) -> Matrix:
    """Cross-sectional z-score."""
    mu = x.mean(axis=1)
    sigma = x.std(axis=1)
    return x.sub(mu, axis=0).div(sigma.replace(0, np.nan), axis=0)


def _demean(x: Matrix) -> Matrix:
    """Subtract cross-sectional mean."""
    return x.sub(x.mean(axis=1), axis=0)


def _winsorize(x: Matrix, pct: float = 0.05) -> Matrix:
    """Clip extreme cross-sectional values."""
    lo = x.quantile(pct, axis=1)
    hi = x.quantile(1 - pct, axis=1)
    return x.clip(lower=lo, upper=hi, axis=0)


# ── Time-series operators ──────────────────────────────────────────────────────

def _ts_mean(x: Matrix, d: int) -> Matrix:
    return x.rolling(d, min_periods=max(1, d // 2)).mean()


def _ts_std(x: Matrix, d: int) -> Matrix:
    return x.rolling(d, min_periods=max(2, d // 2)).std()


def _ts_sum(x: Matrix, d: int) -> Matrix:
    return x.rolling(d, min_periods=max(1, d // 2)).sum()


def _ts_max(x: Matrix, d: int) -> Matrix:
    return x.rolling(d, min_periods=max(1, d // 2)).max()


def _ts_min(x: Matrix, d: int) -> Matrix:
    return x.rolling(d, min_periods=max(1, d // 2)).min()


def _ts_delta(x: Matrix, d: int) -> Matrix:
    """x(t) - x(t-d)"""
    return x.diff(d)


def _ts_delay(x: Matrix, d: int) -> Matrix:
    """x(t-d)"""
    return x.shift(d)


def _ts_rank(x: Matrix, d: int) -> Matrix:
    """Time-series rank of today's value within the past d days, scaled [-1, 1]."""
    def _row_rank(col: pd.Series) -> pd.Series:
        def rank_last(window):
            if len(window) < 2:
                return np.nan
            return pd.Series(window).rank(pct=True).iloc[-1] * 2 - 1
        return col.rolling(d).apply(rank_last, raw=True)
    return x.apply(_row_rank)


def _ts_corr(x: Matrix, y: Matrix, d: int) -> Matrix:
    """Rolling d-day correlation between x and y for each asset."""
    if not isinstance(x, pd.DataFrame) or not isinstance(y, pd.DataFrame):
        raise ValueError("ts_corr requires two matrix arguments")
    cols = x.columns.intersection(y.columns)
    result = pd.DataFrame(index=x.index, columns=cols, dtype=float)
    for col in cols:
        result[col] = x[col].rolling(d, min_periods=max(2, d // 2)).corr(y[col])
    return result


def _ts_decay_linear(x: Matrix, d: int) -> Matrix:
    """Linearly weighted moving average (most recent = highest weight)."""
    weights = np.arange(1, d + 1, dtype=float)
    weights /= weights.sum()

    def _apply(col: pd.Series) -> pd.Series:
        return col.rolling(d).apply(lambda w: np.dot(w, weights), raw=True)

    return x.apply(_apply)


def _ts_autocorr(x: Matrix, lag: int, window: int) -> Matrix:
    """Rolling autocorrelation with given lag."""
    def _apply(col: pd.Series) -> pd.Series:
        return col.rolling(window).apply(
            lambda w: pd.Series(w).autocorr(lag=lag), raw=False
        )
    return x.apply(_apply)


# ── Group operators ────────────────────────────────────────────────────────────

def _group_rank(x: Matrix, group: Matrix) -> Matrix:
    """Rank within group cross-sectionally."""
    result = pd.DataFrame(index=x.index, columns=x.columns, dtype=float)
    for date in x.index:
        row = x.loc[date]
        grp = group.loc[date]
        for g in grp.unique():
            mask = grp == g
            sub = row[mask]
            ranked = sub.rank(pct=True, na_option="keep") * 2 - 1
            result.loc[date, mask] = ranked.values
    return result


def _group_zscore(x: Matrix, group: Matrix) -> Matrix:
    """Z-score within group cross-sectionally."""
    result = pd.DataFrame(index=x.index, columns=x.columns, dtype=float)
    for date in x.index:
        row = x.loc[date]
        grp = group.loc[date]
        for g in grp.unique():
            mask = grp == g
            sub = row[mask]
            mu, sigma = sub.mean(), sub.std()
            if sigma > 0:
                result.loc[date, mask] = ((sub - mu) / sigma).values
    return result


def _group_neutralize(alpha: Matrix, group: Matrix) -> Matrix:
    """Remove group mean from alpha (sector-neutral)."""
    result = alpha.copy()
    for date in alpha.index:
        row = alpha.loc[date]
        grp = group.loc[date]
        for g in grp.unique():
            mask = grp == g
            sub = row[mask]
            result.loc[date, mask] = (sub - sub.mean()).values
    return result
