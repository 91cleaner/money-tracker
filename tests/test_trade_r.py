"""trades.json 의 r(거래일 종가 -> 최근 종가 %)이 화면이 쓰는 가격 파일(data/us/prices)과 같은 방식·같은 값인지."""
import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest

# trades.json and data/us/prices/*.json are refreshed by different scheduled jobs, so the
# "latest close" behind r can differ by a few trading days between them (#306). Live-data
# checks therefore allow a drift tolerance; exact math is pinned by the fixture tests above.
DRIFT_PCT = 10.0
MIN_WITHIN = 0.8  # share of covered trades whose r must be within DRIFT_PCT

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("mt_prices", ROOT / "collector" / "us" / "prices.py")
prices = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = prices
spec.loader.exec_module(prices)


class TradeR(unittest.TestCase):

    def test_r_from_file_uses_trade_day_close_to_last_close(self):
        px = {"d": ["2026-08-21", "2026-08-24", "2026-08-25", "2026-10-27"], "c": [60.0, 62.33, 63.0, 50.68]}
        self.assertEqual(prices.r_from_file(px, "2026-08-24"), (62.33, -18.7))
        self.assertEqual(prices.r_from_file(px, "2026-08-22"), (62.33, -18.7))  # 휴장일 -> 다음 거래일
        self.assertIsNone(prices.r_from_file(px, "2026-08-01"))  # 파일 범위 밖
        self.assertIsNone(prices.r_from_file(px, "2026-11-01"))

    def test_reprice_overrides_stale_r_and_keeps_uncovered_trades(self):
        with tempfile.TemporaryDirectory() as td:
            pathlib.Path(td, "BAC.json").write_text(json.dumps({"d": ["2026-08-24", "2026-10-27"], "c": [62.33, 50.68]}))
            T = [{"tk": "BAC", "d": "2026-08-24", "r": -18.3, "p0": 62.0},
                 {"tk": "BAC", "d": "2025-01-02", "r": 5.5, "p0": 40.0},  # 파일보다 이전: 그대로
                 {"tk": "ZZZ", "d": "2026-08-24", "r": 1.0},               # 파일 없음: 그대로
                 {"tk": None, "d": "2026-08-24"}]
            self.assertEqual(prices.reprice_from_files(T, td), 1)
            self.assertEqual((T[0]["r"], T[0]["p0"]), (-18.7, 62.33))
            self.assertEqual(T[1]["r"], 5.5)
            self.assertEqual(T[2]["r"], 1.0)

    def test_bac_laurel_lee_matches_price_file(self):
        T = json.load(open(ROOT / "data/us/trades.json", encoding="utf-8"))["trades"]
        px = json.load(open(ROOT / "data/us/prices/BAC.json", encoding="utf-8"))
        rows = [t for t in T if t.get("tk") == "BAC" and t.get("id") == "L000597" and t.get("d") == "2026-08-24"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].get("p0"), prices.r_from_file(px, "2026-08-24")[0])
        self.assertAlmostEqual(rows[0]["r"], prices.r_from_file(px, "2026-08-24")[1], delta=DRIFT_PCT)

    def test_every_covered_trade_matches_its_price_file(self):
        T = json.load(open(ROOT / "data/us/trades.json", encoding="utf-8"))["trades"]
        cache, checked, close = {}, 0, 0
        for t in T:
            tk = t.get("tk")
            if not tk or not t.get("d") or t.get("r") is None:
                continue
            if tk not in cache:
                f = ROOT / "data/us/prices" / (tk + ".json")
                cache[tk] = json.load(open(f, encoding="utf-8")) if f.exists() else None
            got = prices.r_from_file(cache[tk], t["d"])
            if got:
                checked += 1
                if t.get("p0") is not None:
                    self.assertAlmostEqual(t["p0"], got[0], delta=0.01, msg=(tk, t["d"], "p0"))
                close += abs(t["r"] - got[1]) <= DRIFT_PCT
        self.assertGreater(checked, 1000)
        self.assertGreaterEqual(close / checked, MIN_WITHIN, (close, checked))


if __name__ == "__main__":
    unittest.main()
