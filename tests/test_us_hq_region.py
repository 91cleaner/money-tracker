"""국민연금 미국 13F 본사 지역 합계. 실행: python -m unittest tests.test_us_hq_region"""
import importlib.util
import json
import os
import unittest
from decimal import Decimal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location("build_us_hq_region", os.path.join(ROOT, "scripts", "build_us_hq_region.py"))
build = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build)
HQ = os.path.join(ROOT, "data", "nps", "us_hq_region.json")
HOLD = os.path.join(ROOT, "data", "nps", "holdings_us_2026Q2.json")


def D(v):
    return Decimal(str(v))


class PlaceFromAddress(unittest.TestCase):
    def test_us_business_state(self):
        got = build.place_from_address({
            "stateOrCountry": "CA", "stateOrCountryDescription": "CA",
            "country": None, "isForeignLocation": None,
        })
        self.assertEqual(got["kind"], "state")
        self.assertEqual(got["code"], "CA")
        self.assertEqual(got["name"], "캘리포니아")

    def test_unknown_code_is_not_a_state(self):
        self.assertIsNone(build.place_from_address({
            "stateOrCountry": "X0", "stateOrCountryDescription": "X0",
        }))

    def test_uk_description(self):
        got = build.place_from_address({
            "stateOrCountry": "X0", "stateOrCountryDescription": "United Kingdom",
        })
        self.assertEqual(got["kind"], "country")
        self.assertEqual(got["name"], "영국")

    def test_foreign_country_field(self):
        got = build.place_from_address({
            "isForeignLocation": 1, "country": "Ireland", "countryCode": "L2",
        })
        self.assertEqual(got["kind"], "country")
        self.assertEqual(got["name"], "아일랜드")

    def test_foreign_flag_does_not_become_a_us_state(self):
        got = build.place_from_address({
            "isForeignLocation": 1, "stateOrCountry": "CA", "country": "Canada",
        })
        self.assertEqual(got["kind"], "country")
        self.assertEqual(got["name_en"], "Canada")

    def test_empty_address_is_unplaced(self):
        self.assertIsNone(build.place_from_address({
            "city": None, "stateOrCountry": None, "country": None,
        }))


class UsHqRegion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(HQ, encoding="utf-8") as f:
            cls.hq = json.load(f)
        with open(HOLD, encoding="utf-8") as f:
            cls.hold = json.load(f)

    def test_total_matches_13f(self):
        self.assertEqual(self.hq["total_value_usd"], self.hold["total_value_usd"])
        self.assertEqual(self.hq["total_value_usd"], 155079663358)

    def test_regions_plus_unmatched_equal_total(self):
        regions = sum((D(r["value_usd"]) for r in self.hq["regions"]), Decimal(0))
        self.assertEqual(regions + D(self.hq["unmatched_value_usd"]), D(self.hq["total_value_usd"]))

    def test_every_region_has_a_real_point_and_percent(self):
        for r in self.hq["regions"]:
            self.assertIsNotNone(r["lat"])
            self.assertIsNotNone(r["lng"])
            self.assertGreater(r["value_usd"], 0)
            self.assertEqual(D(r["pct"]), D(build.pct(r["value_usd"], self.hq["total_value_usd"])))
            self.assertEqual(len(r["top"]), min(5, r["company_count"]))

    def test_unmatched_is_labeled_separately(self):
        self.assertGreater(self.hq["unmatched_count"], 0)
        self.assertEqual(
            sum(D(x["value_usd"]) for x in self.hq["unmatched"]),
            D(self.hq["unmatched_value_usd"]),
        )
        self.assertFalse(self.hq["other_overseas_files"])
        self.assertIn("미국 주식만 공개돼 있어요", self.hq["scope_line"])

    def test_top_state_is_california(self):
        top = self.hq["regions"][0]
        self.assertEqual(top["code"], "CA")
        self.assertEqual(top["name"], "캘리포니아")
        self.assertEqual(top["top"][0]["ticker"], "NVDA")


if __name__ == "__main__":
    unittest.main()
