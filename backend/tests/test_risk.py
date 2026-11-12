"""
Tests for app.engine.risk. Run from backend/:

    .venv/bin/python -m unittest discover -s tests -t . -v

The estimators are checked against closed-form answers, the Kupiec test against its
textbook likelihood ratio, and the backtest against series where the right verdict is known.
"""
import json
import math
import unittest

import numpy as np
import pandas as pd
from scipy import stats

from app.engine import risk
from app.engine.backtest import run_backtest


def make_series(values, start="2019-01-02"):
    idx = pd.bdate_range(start, periods=len(values))
    return pd.Series(np.asarray(values, dtype=float), index=idx)


class EstimatorTests(unittest.TestCase):
    def test_gaussian_matches_closed_form(self):
        var, cvar = risk.gaussian_var_cvar(0.0, 0.01, 0.99)
        self.assertAlmostEqual(var, 0.02326, places=4)  # 2.3263 sigma
        self.assertAlmostEqual(cvar, 0.02665, places=4)  # sigma * pdf(z) / alpha

    def test_gaussian_scales_with_square_root_of_time(self):
        one, _ = risk.gaussian_var_cvar(0.0, 0.01, 0.99, horizon=1)
        ten, _ = risk.gaussian_var_cvar(0.0, 0.01, 0.99, horizon=10)
        self.assertAlmostEqual(ten / one, math.sqrt(10), places=6)

    def test_historical_recovers_normal_quantiles(self):
        x = np.random.default_rng(1).normal(0.0, 0.01, 400_000)
        var, cvar = risk.historical_var_cvar(x, 0.99)
        self.assertAlmostEqual(var, 0.02326, delta=0.0005)
        self.assertAlmostEqual(cvar, 0.02665, delta=0.0007)

    def test_cvar_is_never_below_var(self):
        x = np.random.default_rng(2).standard_t(4, 5_000) * 0.01
        for c in (0.9, 0.95, 0.99):
            var, cvar = risk.historical_var_cvar(x, c)
            self.assertGreaterEqual(cvar, var)

    def test_student_t_fit_finds_fat_tails_and_exceeds_gaussian(self):
        x = np.random.default_rng(3).standard_t(4, 20_000) * 0.01
        df, _, _ = risk.fit_student_t(x)
        self.assertTrue(3.0 <= df <= 6.0, f"df={df}")
        rep = risk.compute_risk(make_series(x))
        row99 = next(r for r in rep["var"] if r["confidence"] == 0.99)
        cvar99 = next(r for r in rep["cvar"] if r["confidence"] == 0.99)
        # A Gaussian understates the 99% tail of fat-tailed returns; the t-based Monte Carlo does not.
        self.assertGreater(row99["monte_carlo"], row99["gaussian"])
        self.assertGreater(cvar99["historical"], cvar99["gaussian"])


class BacktestTestTests(unittest.TestCase):
    @staticmethod
    def _textbook_kupiec(t, k, p):
        pi = k / t
        l0 = (t - k) * math.log(1 - p) + k * math.log(p)
        l1 = (t - k) * math.log(1 - pi) + k * math.log(pi)
        return -2 * (l0 - l1)

    def test_kupiec_matches_textbook_formula(self):
        for t, k, p in [(250, 4, 0.01), (500, 12, 0.01), (1000, 70, 0.05)]:
            lr, pval = risk.kupiec_pof(t, k, p)
            self.assertAlmostEqual(lr, self._textbook_kupiec(t, k, p), places=9)
            self.assertAlmostEqual(pval, stats.chi2.sf(lr, 1), places=12)

    def test_kupiec_is_zero_when_the_rate_matches(self):
        lr, pval = risk.kupiec_pof(1000, 10, 0.01)
        self.assertAlmostEqual(lr, 0.0, places=9)
        self.assertAlmostEqual(pval, 1.0, places=9)

    def test_kupiec_handles_zero_exceptions(self):
        lr, _ = risk.kupiec_pof(250, 0, 0.01)
        self.assertAlmostEqual(lr, -2 * 250 * math.log(0.99), places=9)

    def test_independence_flags_a_cluster_but_not_an_even_spread(self):
        clustered = np.zeros(1000, dtype=bool)
        clustered[400:420] = True
        spread = np.zeros(1000, dtype=bool)
        spread[::50] = True  # same count, evenly spaced
        self.assertLess(risk.christoffersen_independence(clustered)[1], 0.001)
        self.assertGreater(risk.christoffersen_independence(spread)[1], risk.SIGNIFICANCE)

    def test_independence_with_no_exceptions_is_neutral(self):
        self.assertEqual(risk.christoffersen_independence(np.zeros(100, dtype=bool)), (0.0, 1.0))

    def test_rolling_backtest_is_well_calibrated_on_iid_data(self):
        rep = risk.compute_risk(make_series(np.random.default_rng(5).normal(0.0003, 0.01, 3000)))
        row95 = next(r for r in rep["backtest"] if r["confidence"] == 0.95)
        self.assertEqual(row95["observations"], 3000 - 250)
        self.assertTrue(0.035 <= row95["rate"] <= 0.065, row95)

    def test_backtest_fails_when_volatility_regime_shifts(self):
        rng = np.random.default_rng(6)
        calm = rng.normal(0.0, 0.005, 700)
        wild = rng.normal(0.0, 0.02, 500)
        rep = risk.compute_risk(make_series(np.concatenate([calm, wild])))
        verdicts = {r["confidence"]: r["verdict"] for r in rep["backtest"]}
        self.assertNotEqual(verdicts[0.99], "pass")
        row99 = next(r for r in rep["backtest"] if r["confidence"] == 0.99)
        self.assertGreaterEqual(row99["exceptions"], row99["expected"] * 2)
        # While the 250-day window still holds calm days it understates risk, so misses run well
        # above the 1% target; once the window has turned over they should settle back down.
        window = row99["window"]
        shift = 700 - window  # index of the first wild day in the forecast series
        breaches = [i for i, r in enumerate(rep["series"]) if r["pnl"] < -r["var99"]]

        def rate(lo, hi):
            return len([i for i in breaches if lo <= i < hi]) / (hi - lo)

        before, during, after = rate(0, shift), rate(shift, shift + window), rate(shift + window, len(rep["series"]))
        self.assertGreaterEqual(during, 2 * before)
        self.assertLessEqual(after, 0.03)

    def test_forecast_uses_only_earlier_days(self):
        # A single huge loss on the last day cannot be in its own VaR window.
        x = np.random.default_rng(7).normal(0.0, 0.01, 400)
        x[-1] = -0.5
        rep = risk.compute_risk(make_series(x))
        last = rep["series"][-1]
        self.assertAlmostEqual(last["pnl"], -0.5)
        self.assertLess(last["var99"], 0.1)  # forecast made without knowing about the loss
        row99 = next(r for r in rep["backtest"] if r["confidence"] == 0.99)
        self.assertGreaterEqual(row99["exceptions"], 1)


class StressTests(unittest.TestCase):
    def test_worst_stretch_finds_the_planted_loss(self):
        x = np.full(300, 0.001)
        x[100:105] = -0.03
        rep = risk.compute_risk(make_series(x + np.random.default_rng(8).normal(0, 1e-5, 300)))
        by_days = {s["days"]: s for s in rep["stress"]["worst_stretches"]}
        self.assertAlmostEqual(by_days[5]["return"], 0.97**5 - 1, places=3)
        dates = make_series(x).index
        self.assertEqual(by_days[5]["start"], str(dates[100].date()))
        self.assertEqual(by_days[5]["end"], str(dates[104].date()))
        self.assertAlmostEqual(by_days[1]["return"], -0.03, places=3)

    def test_named_windows_appear_only_when_the_data_covers_them(self):
        x = np.random.default_rng(9).normal(0.0004, 0.008, 780)
        rep = risk.compute_risk(make_series(x, start="2021-01-04"))  # runs to about the end of 2023
        names = {w["name"] for w in rep["stress"]["windows"]}
        self.assertIn("2022 rate shock", names)
        self.assertNotIn("COVID crash", names)
        window = next(w for w in rep["stress"]["windows"] if w["name"] == "2022 rate shock")
        s = make_series(x, start="2021-01-04")
        inside = s[(s.index >= "2022-01-03") & (s.index <= "2022-10-12")]
        self.assertAlmostEqual(window["return"], float(np.prod(1 + inside.values) - 1), places=5)

    def test_volatility_shocks_scale_the_tail(self):
        rep = risk.compute_risk(make_series(np.random.default_rng(10).normal(0.0, 0.01, 1500)))
        shocks = {s["multiple"]: s["var"] for s in rep["stress"]["vol_shocks"]}
        self.assertAlmostEqual(shocks[2.0] / shocks[1.5], 2.0 / 1.5, delta=0.02)
        self.assertGreater(shocks[3.0], shocks[2.0])


class InputHandlingTests(unittest.TestCase):
    def test_too_little_history_returns_none(self):
        self.assertIsNone(risk.compute_risk(make_series(np.random.default_rng(11).normal(0, 0.01, 60))))

    def test_flat_series_returns_none(self):
        self.assertIsNone(risk.compute_risk(make_series(np.zeros(500))))

    def test_leading_zero_days_before_the_first_trade_are_ignored(self):
        x = np.concatenate([np.zeros(40), np.random.default_rng(12).normal(0, 0.01, 400)])
        rep = risk.compute_risk(make_series(x))
        self.assertEqual(rep["n_obs"], 400)

    def test_nans_are_dropped(self):
        x = np.random.default_rng(13).normal(0, 0.01, 500)
        x[[10, 200]] = np.nan
        self.assertEqual(risk.compute_risk(make_series(x))["n_obs"], 498)

    def test_short_history_shrinks_the_window_instead_of_skipping_the_backtest(self):
        rep = risk.compute_risk(make_series(np.random.default_rng(14).normal(0, 0.01, 260)))
        self.assertTrue(rep["backtest"])
        self.assertLess(rep["backtest"][0]["window"], risk.VAR_WINDOW)

    def test_report_is_strict_json(self):
        rep = risk.compute_risk(make_series(np.random.default_rng(15).standard_t(5, 1200) * 0.01))
        json.dumps(rep, allow_nan=False)  # raises on NaN or inf

    def test_same_seed_gives_the_same_report(self):
        s = make_series(np.random.default_rng(16).normal(0, 0.01, 800))
        self.assertEqual(risk.compute_risk(s), risk.compute_risk(s))


class EngineIntegrationTests(unittest.TestCase):
    def test_run_backtest_returns_a_risk_report(self):
        rng = np.random.default_rng(17)
        dates = pd.bdate_range("2021-01-04", periods=320)
        assets = [f"A{i}" for i in range(30)]
        returns = pd.DataFrame(rng.normal(0.0003, 0.012, (320, 30)), index=dates, columns=assets)
        alpha = -returns.rolling(3).mean()  # a simple reversal signal
        result = run_backtest(alpha=alpha, returns=returns)
        self.assertIn("risk", result)
        self.assertIsNotNone(result["risk"])
        self.assertGreater(result["risk"]["n_obs"], 250)
        json.dumps(result["risk"], allow_nan=False)


if __name__ == "__main__":
    unittest.main()
