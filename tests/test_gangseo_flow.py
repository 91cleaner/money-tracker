"""강서구 통합신청사 흐름: 실데이터, 시·군·구만, 업체 이름 없음."""
import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import build_gangseo_flow as g  # noqa: E402

MAIN = 127283676000  # R26TA01354404 총계약금액


class GangseoFlowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = g.build()

    def test_title_origin_and_balance(self):
        d = self.doc
        self.assertEqual(d["title"], "강서구 통합신청사, 돈은 어디로 갔나")
        self.assertEqual(d["inst"], "서울특별시 강서구")
        self.assertEqual(d["q"], "신청사")
        self.assertEqual(d["origin"], {"name": "강서구청", "lat": 37.5509, "lng": 126.8495})
        self.assertGreater(d["contracts"], 15)
        self.assertEqual(d["mapped"] + d["unmapped"], d["total"])
        self.assertGreaterEqual(d["total"], MAIN)
        self.assertGreater(d["mapped"], 0)
        self.assertLess(d["unmapped"], d["total"] * 0.02)

    def test_main_contract_regions(self):
        by = {f["region"]: f for f in self.doc["flows"]}
        # 주계약 51% 는 전북 전주시 덕진구, 49% 는 서울 종로구 (기존 소재 자료).
        self.assertEqual(by["전북 전주시 덕진구"]["amount"], round(MAIN * 51 / 100))
        self.assertGreaterEqual(by["서울 종로구"]["amount"], round(MAIN * 49 / 100))
        self.assertIn("충북 음성군", by)
        self.assertIn("서울 구로구", by)

    def test_regions_only(self):
        banned = ("주식회사", "(주)", "번지", "한백", "대한통운", "홍우")
        for f in self.doc["flows"]:
            self.assertEqual(set(f), {"region", "lat", "lng", "amount"})
            self.assertGreater(f["amount"], 0)
            self.assertTrue(33 < f["lat"] < 39)
            self.assertTrue(124 < f["lng"] < 132)
            self.assertNotIn(" ", f["region"][:1])
            for word in banned:
                self.assertNotIn(word, f["region"])
        labels = [f["region"] for f in self.doc["flows"]]
        self.assertEqual(len(labels), len(set(labels)))

    def test_page_has_no_company_names(self):
        page = open(os.path.join(ROOT, "gangseo.html"), encoding="utf-8").read()
        js = open(os.path.join(ROOT, "assets", "instflow.js"), encoding="utf-8").read()
        html = open(os.path.join(ROOT, "contracts.html"), encoding="utf-8").read()
        self.assertIn("강서구 통합신청사, 돈은 어디로 갔나", page)
        self.assertIn("assets/instflow.js?v=202610291800", page)
        self.assertIn("assets/instflow.css?v=202610291800", page)
        self.assertIn("gangseo.html", html)
        self.assertIn("p.get('q') === '신청사'", html)
        self.assertNotIn("주식회사", page + js)
        self.assertNotIn("한백", page + js)
        self.assertNotIn("대한통운", page + js)


if __name__ == "__main__":
    unittest.main()
