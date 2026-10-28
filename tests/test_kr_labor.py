import contextlib
import io
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "collector", "kr"))
import labor  # noqa: E402

ROWS = [
    {"rcept_no": "1", "corp_name": "삼성전자", "stock_code": "005930", "report_nm": "[기재정정]노동조합 파업 관련 공시", "rcept_dt": "20261010"},
    {"rcept_no": "2", "corp_name": "(주)현대차", "stock_code": "005380", "report_nm": "생산중단", "rcept_dt": "20261011"},
    {"rcept_no": "3", "corp_name": "작은회사", "stock_code": "", "report_nm": "영업정지", "rcept_dt": "20261012"},
    {"rcept_no": "4", "corp_name": "삼성전자", "stock_code": "005930", "report_nm": "분기보고서", "rcept_dt": "20261013"},
]


class Labor(unittest.TestCase):
    def test_classify(self):
        self.assertEqual(labor.classify("노사분규 발생"), "strike")
        self.assertEqual(labor.classify("공장 가동 중단"), "halt")
        self.assertEqual(labor.classify("영업정지"), "suspend")
        self.assertIsNone(labor.classify("분기보고서"))

    def test_pick_links_tracked(self):
        tracked = {labor.norm_name("삼성전자"): "삼성전자", labor.norm_name("현대차"): "현대차"}
        got = {d["rcept_no"]: d for d in labor.pick(ROWS, tracked)}
        self.assertEqual(set(got), {"1", "2", "3"})
        self.assertTrue(got["1"]["tracked"] and got["2"]["tracked"])
        self.assertFalse(got["3"]["tracked"])
        self.assertEqual(got["1"]["date"], "2026-10-10")
        self.assertTrue(got["1"]["url"].startswith("https://dart.fss.or.kr/"))

    def test_stats_and_sector(self):
        rows = labor.parse_stats({"response": {"body": {"items": [
            {"업종": "자동차 제조업", "연월": "202609", "분규건수": "3", "근로손실일수": "1,200"},
            {"업종": "알수없음업", "연월": "2026-09", "건수": 1},
            {"업종": "x"}]}}})
        inds = {i["name"]: i for i in labor.build_industries(rows)}
        self.assertEqual(inds["자동차 제조업"]["sector_id"], "auto")
        self.assertEqual(inds["자동차 제조업"]["months"]["2026-09"], {"cases": 3.0, "lost_days": 1200.0})
        self.assertIsNone(inds["알수없음업"]["sector_id"])

    def test_no_key_skips(self):
        saved = dict(os.environ)
        for k in ("DART_API_KEY", "DATA_GO_KR_KEY", "LABOR_STATS_URL"):
            os.environ.pop(k, None)
        cwd, tmp = os.getcwd(), tempfile.mkdtemp()
        os.chdir(tmp)
        try:
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                labor.main()
            self.assertIn("dart=skipped", buf.getvalue())
            self.assertTrue(os.path.exists(os.path.join(tmp, "data", "kr", "labor.json")))
        finally:
            os.chdir(cwd)
            os.environ.clear()
            os.environ.update(saved)


if __name__ == "__main__":
    unittest.main()
