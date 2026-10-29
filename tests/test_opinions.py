"""'남들 의견' 수집기 테스트: python3 tests/test_opinions.py"""
import json, os, shutil, sys, tempfile, unittest
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "collector", "opinions"))
import build as B
import fetch_exec as F

TODAY = date(2026, 10, 29)


def post(**kw):
    p = {"id": "1", "handle": "jimcramer", "name": "Jim Cramer", "role": "influencer", "tickers": ["NVDA"],
         "text": "Watching the chip names closely this week.", "lang": "en", "created_at": "2026-10-29T01:23:00Z",
         "url": "https://x.com/jimcramer/status/1", "source": "x"}
    p.update(kw)
    return p


class OpinionsTest(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.d, "auto"))
        os.makedirs(os.path.join(self.d, "answers"))
        shutil.copy(os.path.join(B.OP, "accounts.json"), self.d)
        for t in ("NVDA", "TSLA"):
            open(os.path.join(self.d, "answers", t + ".json"), "w").write("{}")

    def tearDown(self):
        shutil.rmtree(self.d, ignore_errors=True)

    def run_build(self, drops, auto=None):
        json.dump(drops, open(os.path.join(self.d, "2026-10-29.json"), "w"))
        if auto is not None:
            json.dump(auto, open(os.path.join(self.d, "auto", "exec-2026-10-29.json"), "w"))
        return B.build(self.d, os.path.join(self.d, "answers"), TODAY)

    def test_real_config_is_valid(self):
        acc = B.load_accounts()
        self.assertTrue(acc)
        for a in acc.values():
            self.assertIn(a["role"], B.ROLES)
            self.assertTrue(a["tickers"])
            if a["role"] == "exec":
                self.assertTrue(a.get("company_ticker"))
            else:
                self.assertNotIn("company_ticker", a)

    def test_valid_post_kept_and_linked(self):
        out, rej = self.run_build([post()])
        self.assertEqual(rej, [])
        r = out["tickers"]["NVDA"]["opinions"][0]
        self.assertTrue(r["url"].startswith("https://"))

    def test_schema_rejections(self):
        bad = [post(id="2", role="guru"), post(id="3", source="rss"), post(id="4", lang="fr"),
               post(id="5", text="x" * 281), post(id="6", tickers=[]), post(id="7", created_at="2026-10-29"),
               post(id="8", url="http://x.com/a/status/8"), post(id="9", url=""), post(id="10", handle="nobody"),
               post(id="11", role="analyst"), post(id="12", url="https://evil.example/a"), {"id": "13"}, "str"]
        out, rej = self.run_build(bad)
        self.assertEqual(len(rej), len(bad))
        self.assertEqual(out["tickers"], {})

    def test_banned_wording_rejected(self):
        for w in ("이건 추천 종목", "A 때문에 올랐다", "I recommend this", "price target 300"):
            out, rej = self.run_build([post(text=w)])
            self.assertEqual(len(rej), 1, w)

    def test_untracked_ticker_dropped(self):
        out, rej = self.run_build([post(tickers=["ZZZZ"])])
        self.assertEqual(out["tickers"], {})

    def test_duplicate_id_removed(self):
        out, _ = self.run_build([post(), post(), post(id="1", text="same id again")])
        self.assertEqual(len(out["tickers"]["NVDA"]["opinions"]), 1)

    def test_sorted_newest_first_and_old_dropped(self):
        out, _ = self.run_build([post(id="a", created_at="2026-10-20T00:00:00Z"), post(id="b", created_at="2026-10-28T00:00:00Z"),
                                 post(id="c", created_at="2026-01-01T00:00:00Z")])
        self.assertEqual([r["id"] for r in out["tickers"]["NVDA"]["opinions"]], ["b", "a"])

    def test_exec_goes_to_exec_and_only_own_company(self):
        ex = post(id="e1", handle="jensenhuang", name="Jensen Huang", role="exec", tickers=["NVDA", "TSLA"], url="https://x.com/jensenhuang/status/e1")
        out, _ = self.run_build([ex])
        self.assertEqual(len(out["tickers"]["NVDA"]["exec"]), 1)
        self.assertNotIn("TSLA", out["tickers"])
        self.assertEqual(out["tickers"]["NVDA"]["exec"][0]["title"], "CEO")

    def test_official_sources(self):
        sec = post(id="sec8k-NVDA-1", handle="nvda", name="Jensen Huang", role="exec", source="sec8k", url="https://www.sec.gov/Archives/edgar/data/1/2/ex99.htm")
        out, rej = self.run_build([], [sec])
        self.assertEqual(rej, [])
        self.assertEqual(out["tickers"]["NVDA"]["exec"][0]["source"], "sec8k")
        # 공식 출처인데 role 이 exec 가 아니거나 X 링크면 버림
        out, rej = self.run_build([], [dict(sec, role="analyst"), dict(sec, id="z", url="https://x.com/a/status/1")])
        self.assertEqual(len(rej), 2)

    def test_quote_shortened(self):
        long = ("word " * 50).strip()
        out, _ = self.run_build([post(text=long + " https://t.co/abc")])
        q = out["tickers"]["NVDA"]["opinions"][0]["text"]
        self.assertLessEqual(len(q), B.MAX_QUOTE)
        self.assertNotIn("http", q)

    def test_non_array_file_rejected(self):
        json.dump({"a": 1}, open(os.path.join(self.d, "2026-10-28.json"), "w"))
        out, rej = B.build(self.d, os.path.join(self.d, "answers"), TODAY)
        self.assertEqual(len(rej), 1)

    def test_extract_exec_quote(self):
        t = "NVIDIA today reported. “Demand for accelerated computing is strong across every region we serve today,” said Jensen Huang, founder and CEO. More text."
        self.assertEqual(F.extract_exec_quote(t, "Jensen Huang"), "Demand for accelerated computing is strong across every region we serve today")
        self.assertIsNone(F.extract_exec_quote(t, "Tim Cook"))
        adv = "“We recommend investors accumulate shares of our company right away,” said Jensen Huang."
        self.assertIsNone(F.extract_exec_quote(adv, "Jensen Huang"))


if __name__ == "__main__":
    unittest.main()
