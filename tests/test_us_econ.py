import sys, unittest, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "scripts"))
import collect_us_econ as c


class UsEcon(unittest.TestCase):
    def test_bls_parse_and_yoy(self):
        data = [{"year": "2025", "period": "M09", "value": "100.0"}, {"year": "2026", "period": "M09", "value": "103.0"},
                {"year": "2026", "period": "M10", "value": "-"}, {"year": "2026", "period": "M13", "value": "9"}]
        doc = {"status": "REQUEST_SUCCEEDED", "Results": {"series": [{"seriesID": "X", "data": data}]}}
        pts = c.parse_bls(doc)["X"]
        self.assertEqual(pts, [("2025-09", 100.0), ("2026-09", 103.0)])
        self.assertEqual(c.yoy_series(pts), [("2026-09", 3.0)])

    def test_bls_failure_raises(self):
        with self.assertRaises(ValueError):
            c.parse_bls({"status": "REQUEST_NOT_PROCESSED"})

    def test_treasury_parse_skips_blank(self):
        rows = [{"Date": "10/27/2026", "2 Yr": "4.10", "10 Yr": ""}, {"Date": "10/26/2026", "2 Yr": "4.00", "10 Yr": "5.00"}]
        t = c.parse_treasury(rows)
        self.assertEqual(t["10y"], [("2026-10-26", 5.0)])
        self.assertEqual(t["2y"], [("2026-10-26", 4.0), ("2026-10-27", 4.1)])

    def test_card_empty(self):
        self.assertIsNone(c.card([], "%", "x", "https://x"))


if __name__ == "__main__":
    unittest.main()
