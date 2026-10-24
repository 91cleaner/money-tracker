import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "collector", "nps"))
import dart5  # noqa: E402
from datetime import datetime  # noqa: E402

D = datetime.now(dart5.KST).strftime("%Y%m%d")
DD = f"{D[:4]}-{D[4:6]}-{D[6:]}"

LIST = {"status": "000", "total_page": 1, "list": [
    {"corp_code": "00126380", "corp_name": "삼성전자", "stock_code": "005930", "report_nm": "주식등의대량보유상황보고서(일반)",
     "rcept_no": "20261010000123", "flr_nm": "국민연금공단", "rcept_dt": D},
    {"corp_code": "00164779", "corp_name": "SK하이닉스", "stock_code": "000660", "report_nm": "주식등의대량보유상황보고서(일반)",
     "rcept_no": "20261010000124", "flr_nm": "블랙록", "rcept_dt": D},
    {"corp_code": "00126380", "corp_name": "삼성전자", "stock_code": "005930", "report_nm": "임원ㆍ주요주주특정증권등소유상황보고서",
     "rcept_no": "20261010000125", "flr_nm": "국민연금공단", "rcept_dt": D},
]}
MAJOR = {"status": "000", "list": [
    {"rcept_no": "20261010000123", "corp_name": "삼성전자", "stkqy": "520,000,000", "stkqy_irds": "12,000,000",
     "stkrt": "8.71", "stkrt_irds": "0.20", "report_resn": "보유주식등의 수 변동"},
]}


def fake_get(path, **p):
    return {"list.json": LIST, "majorstock.json": MAJOR}[path]


class Dart5(unittest.TestCase):
    def test_no_key_skips(self):
        with mock.patch.dict(os.environ, {}, clear=True), tempfile.TemporaryDirectory() as d, \
                mock.patch.object(dart5, "OUT", os.path.join(d, "x.json")):
            dart5.main()
            self.assertFalse(os.path.exists(os.path.join(d, "x.json")))

    def test_collects_only_nps_major_reports(self):
        with mock.patch.dict(os.environ, {"DART_API_KEY": "k"}), tempfile.TemporaryDirectory() as d, \
                mock.patch.object(dart5, "OUT", os.path.join(d, "x.json")), mock.patch.object(dart5, "get", fake_get), \
                mock.patch.object(dart5.time, "sleep", lambda s: None):
            dart5.main()
            out = json.load(open(os.path.join(d, "x.json"), encoding="utf-8"))
            self.assertEqual(len(out["items"]), 1)
            it = out["items"][0]
            self.assertEqual((it["corp"], it["code"], it["date"]), ("삼성전자", "005930", DD))
            self.assertEqual((it["stake"], it["delta"], it["prev"]), (8.71, 0.2, 8.51))
            self.assertEqual(it["shares"], 520000000)
            # 두 번째 실행은 같은 보고를 다시 넣지 않는다
            dart5.main()
            self.assertEqual(len(json.load(open(os.path.join(d, "x.json"), encoding="utf-8"))["items"]), 1)


if __name__ == "__main__":
    unittest.main()
