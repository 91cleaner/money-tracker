"""분석 엔진 검사 테스트: python3 tests/test_analyze.py"""
import json, os, shutil, sys, tempfile, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts", "analyze"))
import build, verify
from common import banned_hit


class AnalyzeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        build.main(cls.tmp)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_passes(self):
        errs, n = verify.check(self.tmp)
        self.assertEqual(errs, [])
        self.assertGreater(n, 100)

    def test_banned_words_detected(self):
        self.assertTrue(banned_hit("이 종목을 추천"))
        self.assertTrue(banned_hit("매수 시점"))
        self.assertFalse(banned_hit("데이터상 움직였다"))

    def test_number_mismatch_fails(self):
        f = next(x for x in os.listdir(self.tmp) if not x.startswith("_"))
        p = os.path.join(self.tmp, f)
        j = json.load(open(p, encoding="utf-8"))
        first = next(iter(j["periods"]))
        j["periods"][first]["ret"] += 5
        json.dump(j, open(p, "w", encoding="utf-8"), ensure_ascii=False)
        errs, _ = verify.check(self.tmp)
        self.assertTrue(any("불일치" in e for e in errs))
        build.main(self.tmp)  # 복구

    def test_injected_banned_word_fails(self):
        f = next(x for x in os.listdir(self.tmp) if not x.startswith("_"))
        p = os.path.join(self.tmp, f)
        j = json.load(open(p, encoding="utf-8"))
        a = next(iter(next(iter(j["answers"].values())).values()))
        a["ko"][0] += " 매수하세요"
        json.dump(j, open(p, "w", encoding="utf-8"), ensure_ascii=False)
        errs, _ = verify.check(self.tmp)
        self.assertTrue(any("금지어" in e for e in errs))
        build.main(self.tmp)


if __name__ == "__main__":
    unittest.main()
