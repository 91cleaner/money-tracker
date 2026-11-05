"""Offline regression for factual labels in generated U.S. daily cards.

No network or repository data mutation: run the builder against synthetic temp files.
"""
import datetime as dt
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts" / "build_us_daily.py"


class USDailyCopyTest(unittest.TestCase):
    def test_form4_rows_are_not_called_filings_and_whitehouse_is_not_register(self):
        today = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=9)).date().isoformat()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "scripts").mkdir()
            data = root / "data" / "us"
            data.mkdir(parents=True)
            shutil.copy2(BUILDER, root / "scripts" / "build_us_daily.py")

            def put(name, value):
                (data / name).write_text(json.dumps(value), encoding="utf-8")

            put("trades.json", {"trades": [
                {"who": "House Member", "c": "h", "fd": today, "d": today,
                 "tk": "AAA", "ty": "P", "amt": "$1,001-$15,000", "doc": "https://disclosures-clerk.house.gov/"},
                {"who": "Senate Member", "c": "s", "fd": today, "d": today,
                 "tk": "BBB", "ty": "S", "amt": "$1,001-$15,000", "doc": "https://efdsearch.senate.gov/"}
            ]})
            put("whitehouse.json", {"items": [
                {"kind": "presdoc", "date": today, "t": "Official announcement",
                 "u": "https://www.whitehouse.gov/", "type": "Presidential document"}
            ]})
            # Two transaction rows from one reporter and URL are NOT two filings.
            put("insider-form4.json", {"companies": {"META": {"trades": [
                {"filed": today, "date": today, "who": "Director", "code": "S",
                 "shares": 3, "price": 10, "url": "https://www.sec.gov/Archives/edgar/data/example"},
                {"filed": today, "date": today, "who": "Director", "code": "S",
                 "shares": 2, "price": 11, "url": "https://www.sec.gov/Archives/edgar/data/example"}
            ]}}})

            run = subprocess.run(
                [sys.executable, str(root / "scripts" / "build_us_daily.py")],
                cwd=root, capture_output=True, text=True, check=True
            )
            self.assertIn("cards", run.stdout)
            result = json.loads((data / "daily" / (today + ".json")).read_text(encoding="utf-8"))
            cards = {card["id"]: card for card in result["cards"]}

            ptr = cards["ptr"]
            self.assertIn("의원 공개 거래 항목 2건", ptr["h"])
            self.assertNotIn("하원 신고", ptr["h"])
            self.assertEqual(ptr["n"][0]["l"], "거래 항목")

            whitehouse = cards["wh"]
            self.assertIn("백악관에 대통령 문서 1건이 공개", whitehouse["h"])
            self.assertNotIn("관보", whitehouse["h"])

            form4 = cards["f4"]
            self.assertEqual(form4["k"], "SEC Form 4 내부자 거래")
            self.assertIn("SEC Form 4 거래 항목 2건", form4["h"])
            self.assertEqual(form4["n"][0], {"l": "거래 항목", "v": "2건"})
            self.assertNotIn("임원 거래 신고", form4["h"])


if __name__ == "__main__":
    unittest.main()
