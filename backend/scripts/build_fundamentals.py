"""Build point-in-time fundamentals from SEC EDGAR (free) and save them to app/data/fundamentals.json.gz.

Every value is stamped with the date the filing was made public, so a backtest only sees numbers that were
known at the time. Flow items (sales, income, cash flow) are trailing-twelve-month sums of reported quarters.

Run from backend/:  python scripts/build_fundamentals.py
"""
from __future__ import annotations

import gzip
import json
import sys
import time
from datetime import date, datetime
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.data.universe import SP500_TICKERS_SAMPLE  # noqa: E402

UA = {"User-Agent": "lavaquant research dpilat@uchicago.edu"}
OUT = Path(__file__).resolve().parents[1] / "app" / "data" / "fundamentals.json.gz"
SINCE = "2017-01-01"  # earliest period end we keep; TTM needs a year of history before 2020

FLOW = {
    "sales": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet",
              "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueGoodsNet", "RevenuesNetOfInterestExpense"],
    "net_income": ["NetIncomeLoss", "ProfitLoss"],
    "operating_income": ["OperatingIncomeLoss"],
    "cashflow_op": ["NetCashProvidedByUsedInOperatingActivities"],
}
INSTANT = {
    "equity": ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
    "assets": ["Assets"],
    "liabilities": ["Liabilities"],
}
# weighted-average diluted shares covers every share class together; the cover-page count does not
SHARES = ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfSharesOutstandingBasic"]


def d(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def collect(facts: dict, tags: list[str]) -> list[tuple]:
    """(start, end, filed, val) for every unit-USD / shares fact under any of the tags."""
    out = {}
    gaap = facts.get("us-gaap", {})
    for tag in tags:
        node = gaap.get(tag)
        if not node:
            continue
        for unit, rows in node["units"].items():
            if unit not in ("USD", "shares"):
                continue
            for r in rows:
                if r["end"] < SINCE or "filed" not in r:
                    continue
                key = (r.get("start"), r["end"], r["filed"])
                out.setdefault(key, r["val"])
    return [(k[0], k[1], k[2], v) for k, v in out.items()]


def known_at(rows: list[tuple], cutoff: str) -> dict[tuple, float]:
    """Latest-filed value for each (start, end) period among filings made on or before cutoff."""
    best: dict[tuple, tuple[str, float]] = {}
    for start, end, filed, val in rows:
        if filed > cutoff:
            continue
        k = (start, end)
        if k not in best or filed >= best[k][0]:
            best[k] = (filed, val)
    return {k: v[1] for k, v in best.items()}


def ttm(rows: list[tuple], cutoff: str):
    per = known_at(rows, cutoff)
    by_start: dict[str, dict[str, float]] = {}
    for (start, end), val in per.items():
        if start and 80 <= (d(end) - d(start)).days <= 380:
            by_start.setdefault(start, {})[end] = val

    quarters: dict[str, float] = {}
    # reported three-month values
    for start, m in by_start.items():
        for end, val in m.items():
            if (d(end) - d(start)).days <= 100:
                quarters[end] = val
    # cash-flow statements only report year-to-date totals, so a quarter is the difference of two totals that share a start
    for start, m in by_start.items():
        prev_end, prev_val = None, None
        for end in sorted(m):
            if prev_end is not None and 80 <= (d(end) - d(prev_end)).days <= 100:
                quarters.setdefault(end, m[end] - prev_val)
            prev_end, prev_val = end, m[end]

    ends = sorted(quarters)
    for i in range(len(ends) - 1, 2, -1):
        window = ends[i - 3 : i + 1]
        gaps = [(d(window[j + 1]) - d(window[j])).days for j in range(3)]
        if all(80 <= g <= 100 for g in gaps):
            return sum(quarters[e] for e in window), ends[i]
    annuals = [(end, val) for m in by_start.values() for end, val in m.items() if False]
    for start, m in by_start.items():
        for end, val in m.items():
            if 350 <= (d(end) - d(start)).days <= 380:
                annuals.append((end, val))
    if annuals:
        end, val = max(annuals)
        return val, end
    return None, None


def latest_instant(rows: list[tuple], cutoff: str):
    per = known_at(rows, cutoff)
    pts = [(end, v) for (start, end), v in per.items() if start is None]
    if not pts:
        # some filers tag balance items with a start date; accept very short durations
        pts = [(end, v) for (start, end), v in per.items() if start and (d(end) - d(start)).days <= 1]
    return max(pts)[1] if pts else None


def latest_shares(rows: list[tuple], cutoff: str):
    per = known_at(rows, cutoff)
    pts = [(end, v) for (start, end), v in per.items() if start and (d(end) - d(start)).days <= 380]
    return max(pts)[1] if pts else None


def build_one(facts: dict) -> dict[str, list[list]]:
    rows = {name: collect(facts, tags) for name, tags in {**FLOW, **INSTANT}.items()}
    rows["shares_out"] = collect(facts, SHARES)
    filings = sorted({r[2] for rs in rows.values() for r in rs if r[2] >= "2018-01-01"})
    series: dict[str, list[list]] = {k: [] for k in rows}
    for f in filings:
        for name in FLOW:
            v, _ = ttm(rows[name], f)
            if v is not None:
                series[name].append([f, v])
        for name in INSTANT:
            v = latest_instant(rows[name], f)
            if v is not None:
                series[name].append([f, v])
        v = latest_shares(rows["shares_out"], f)
        if v is not None:
            if v < 1e5:  # a few filers report share counts in millions
                v *= 1e6
            series["shares_out"].append([f, v])
    # liabilities missing (some filers never tag it): assets minus equity
    if not series["liabilities"] and series["assets"] and series["equity"]:
        eq = dict(map(tuple, series["equity"]))
        series["liabilities"] = [[f, a - eq[f]] for f, a in series["assets"] if f in eq]
    # keep only points where the value changed
    for k, pts in series.items():
        thin, last = [], None
        for f, v in pts:
            if v != last:
                thin.append([f, v])
                last = v
        series[k] = thin
    return series


def splits_for(ticker: str) -> list[list]:
    """Stock splits [[date, ratio]]. Prices are split-adjusted but filings report shares as of their own date,
    so market cap needs the shares scaled up by every split that happened afterwards."""
    import yfinance as yf

    try:
        sp = yf.Ticker(ticker).splits
        return [[str(i.date()), float(r)] for i, r in sp.items() if r and r != 1]
    except Exception:
        return []


# Companies that moved to a new holding company (new CIK) keep their history under the old one; load both.
EXTRA_CIKS = {"XOM": [34088], "MMC": [62709]}


def merge_facts(a: dict, b: dict) -> dict:
    for taxo, tags in b.items():
        mine = a.setdefault(taxo, {})
        for tag, node in tags.items():
            if tag not in mine:
                mine[tag] = node
                continue
            for unit, rows in node["units"].items():
                mine[tag]["units"].setdefault(unit, []).extend(rows)
    return a


def main() -> None:
    with httpx.Client(headers=UA, timeout=60) as c:
        cmap = {r["ticker"].upper(): int(r["cik_str"]) for r in c.get("https://www.sec.gov/files/company_tickers.json").json().values()}
        out: dict[str, dict] = {}
        for i, t in enumerate(SP500_TICKERS_SAMPLE):
            cik = cmap.get(t.replace("-", ".")) or cmap.get(t)
            ciks = ([cik] if cik else []) + EXTRA_CIKS.get(t, [])
            if not ciks:
                print(f"[{i + 1:3}/{len(SP500_TICKERS_SAMPLE)}] {t:6} no CIK (ETF or not a US filer)")
                continue
            facts: dict = {}
            for k in ciks:
                r = c.get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{k:010d}.json")
                if r.status_code == 200:
                    merge_facts(facts, r.json()["facts"])
                time.sleep(0.2)
            if not facts:
                print(f"[{i + 1:3}] {t} no data")
                continue
            s = build_one(facts)
            s["splits"] = splits_for(t)
            out[t] = s
            have = ",".join(k for k, v in s.items() if v)
            print(f"[{i + 1:3}/{len(SP500_TICKERS_SAMPLE)}] {t:6} {have}")
            time.sleep(0.2)  # SEC asks for under 10 requests a second

    payload = {"built": str(date.today()), "source": "SEC EDGAR XBRL company facts", "tickers": out}
    with gzip.open(OUT, "wt") as f:
        json.dump(payload, f, separators=(",", ":"))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB, {len(out)} tickers)")


if __name__ == "__main__":
    main()
