import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "collector"))
import share_more  # noqa: E402


class ShareMore(unittest.TestCase):
    def test_korean_names_read_from_js(self):
        share_more.ROOT = os.path.join(os.path.dirname(__file__), "..")
        ko = share_more.ko_names()
        self.assertEqual(ko.get("NVDA"), "엔비디아")
        self.assertEqual(ko.get("BRK/B"), "버크셔 해서웨이")

    def test_money_format(self):
        self.assertEqual(share_more.eok(55_109_460_000_000), "55조 1,095억원")
        self.assertEqual(share_more.eok(793_100_000_000), "7,931억원")


if __name__ == "__main__":
    unittest.main()
