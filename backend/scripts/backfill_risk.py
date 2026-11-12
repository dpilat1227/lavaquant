"""
Add a `risk` block to saved backtest results that predate the risk module.

    python scripts/backfill_risk.py ../frontend/public/gallery/*.json   # rewrite files in place
    python scripts/backfill_risk.py --stdin < result.json               # print just the risk block

Saved results keep the equity curve even when daily_pnl was stripped to save space, so the
daily returns are rebuilt from the curve when needed. Files that already have a risk block
are left alone unless --force is given. index.json (the gallery listing) is skipped.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.engine.risk import compute_risk  # noqa: E402


def points_to_series(points: list[dict]) -> pd.Series:
    idx = pd.DatetimeIndex([p["date"] for p in points])
    vals = [np.nan if p["value"] is None else p["value"] for p in points]
    return pd.Series(vals, index=idx, dtype=float)


def pnl_from_result(result: dict) -> pd.Series:
    if result.get("daily_pnl"):
        return points_to_series(result["daily_pnl"])
    equity = points_to_series(result["equity_curve"])
    return equity.pct_change().dropna()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="*", type=Path)
    ap.add_argument("--stdin", action="store_true", help="read one result from stdin, print only its risk block")
    ap.add_argument("--force", action="store_true", help="recompute even when a risk block exists")
    args = ap.parse_args()

    if args.stdin:
        risk = compute_risk(pnl_from_result(json.load(sys.stdin)))
        json.dump(risk, sys.stdout, separators=(",", ":"), allow_nan=False)
        return 0

    for path in args.files:
        if path.name == "index.json":
            continue
        raw = path.read_text()
        result = json.loads(raw)
        if "equity_curve" not in result:
            print(f"skip {path.name}: not a backtest result")
            continue
        if result.get("risk") and not args.force:
            print(f"skip {path.name}: already has risk")
            continue
        compact = json.dumps(result, separators=(",", ":"), ensure_ascii=False)
        if compact != raw.strip():
            print(f"note {path.name}: formatting differs from compact JSON, so the whole file will be reformatted")
        result["risk"] = compute_risk(pnl_from_result(result))
        path.write_text(json.dumps(result, separators=(",", ":"), ensure_ascii=False, allow_nan=False))
        print(f"wrote {path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
