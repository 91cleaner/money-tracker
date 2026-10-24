"""국민연금 국내주식 본사 지역 합계. 실행: python -m unittest tests.test_kr_hq_region"""
import importlib.util
import json
import os
import unittest
from decimal import Decimal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location("build_kr_hq_region", os.path.join(ROOT, "scripts", "build_kr_hq_region.py"))
build = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build)
HQ = os.path.join(ROOT, "data", "nps", "kr_hq_region.json")
HOLD = os.path.join(ROOT, "data", "nps", "kr_holdings.json")


def D(v):
    return Decimal(str(v))


class NameAndAddress(unittest.TestCase):
    def test_preferred_share_base(self):
        self.assertEqual(build.preferred_base("삼성전자우"), "삼성전자")
        self.assertEqual(build.preferred_base("현대차2우B"), "현대차")
        self.assertEqual(build.preferred_base("CJ4우(전환)"), "CJ")
        self.assertEqual(build.preferred_base("CJ제일제당 우"), "CJ제일제당")
        self.assertIsNone(build.preferred_base("우리금융지주"))
        self.assertIsNone(build.preferred_base("한국항공우주"))
        self.assertIsNone(build.preferred_base("한온시스템(유상)"))

    def test_address_reads_sido_and_sigungu(self):
        self.assertEqual(build.parse_addr("경기도 수원시 영통구 삼성로 129"), ("경기", "수원시 영통구"))
        self.assertEqual(build.parse_addr("서울 마포구 서교동 477-22"), ("서울", "마포구"))
        self.assertEqual(build.parse_addr("세종특별자치시 한누리대로 123"), ("세종", "세종시"))
        self.assertEqual(build.parse_addr("충청남도 아산시 둔포면 아산밸리로 285"), ("충남", "아산시"))
        self.assertEqual(build.parse_addr("서울시 마포구 양화로 45"), ("서울", "마포구"))
        self.assertEqual(build.parse_addr("서울시마포구 양화로 45"), ("서울", "마포구"))
        self.assertEqual(build.parse_addr("전남광주통합특별시 광산구 어등대로 658"), ("광주", "광산구"))
        self.assertEqual(build.parse_addr("전남광주통합특별시 나주시 예향로 1"), ("전남", "나주시"))
        self.assertIsNone(build.parse_addr("전남광주통합특별시"))
        self.assertIsNone(build.parse_addr("광주시 경안동"))
        self.assertIsNone(build.parse_addr("미국 캘리포니아"))


class KrHqRegion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(HQ, encoding="utf-8") as f:
            cls.hq = json.load(f)
        with open(HOLD, encoding="utf-8") as f:
            cls.hold = json.load(f)

    def test_region_sums_plus_unmatched_equal_total(self):
        regions = sum((D(r["value_100m_krw"]) for r in self.hq["regions"]), Decimal("0"))
        unmatched = D(self.hq["unmatched_value_100m_krw"])
        self.assertEqual(regions + unmatched, D(self.hq["total_value_100m_krw"]))

    def test_total_matches_holdings_file(self):
        self.assertEqual(self.hq["total_value_100m_krw"], self.hold["total_value_100m_krw"])

    def test_every_holding_is_placed_or_unmatched(self):
        got = [(c["company"], c["rank"], D(c["value_100m_krw"])) for c in self.hq["companies"]]
        got += [(c["company"], c["rank"], D(c["value_100m_krw"])) for c in self.hq["unmatched"]]
        exp = [(c["company"], c["rank"], D(c["value_100m_krw"])) for c in self.hold["holdings"]]
        self.assertEqual(sorted(got), sorted(exp))

    def test_unmatched_value_is_sum_of_lines(self):
        s = sum((D(c["value_100m_krw"]) for c in self.hq["unmatched"]), Decimal("0"))
        self.assertEqual(s, D(self.hq["unmatched_value_100m_krw"]))

    def test_sigungu_does_not_exceed_sido(self):
        for r in self.hq["regions"]:
            gu = sum((D(g["value_100m_krw"]) for g in r["sigungu"]), Decimal("0"))
            self.assertEqual(gu, D(r["value_100m_krw"]))
            self.assertTrue(r["sido"])
            for g in r["sigungu"]:
                self.assertTrue(g["name"])


if __name__ == "__main__":
    unittest.main()
