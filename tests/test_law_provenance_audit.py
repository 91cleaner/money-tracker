"""Regression tests for the independent, read-only world-law audit."""
import importlib.util
from datetime import date
from pathlib import Path
import unittest

PATH = Path(__file__).resolve().parents[1] / "scripts" / "audit-law-provenance.py"
spec = importlib.util.spec_from_file_location("law_provenance_audit", PATH)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class LawProvenanceAuditTests(unittest.TestCase):
    def setUp(self):
        self.row = {"id": "JP-1", "t": "Sample", "d": "2026-01-02",
                    "st": "成立", "sd": "", "u": "https://www.shugiin.go.jp/example"}

    def inspect(self, row, cc="jp"):
        return audit.audit_document(cc, {"count": 1, "source_url": "https://www.shugiin.go.jp/", "rows": [row]}, date(2026, 10, 28))

    def test_passed_without_action_date_is_flagged_not_inferred_from_introduction(self):
        for cc, st in (("jp", "成立"), ("kr", "원안가결"), ("tw", "三讀通過"),
                       ("us", "Signed by President")):
            with self.subTest(cc=cc):
                row = dict(self.row, st=st)
                self.assertEqual(self.inspect(row, cc)["enacted_action_date_missing"], 1)
        self.assertEqual(self.inspect(dict(self.row, st="審議中"))["enacted_action_date_missing"], 0)
        self.assertEqual(self.inspect(dict(self.row, sd="2026-02-03"))["enacted_action_date_missing"], 0)

    def test_invalid_future_and_out_of_order_dates(self):
        result = self.inspect(dict(self.row, sd="2026-02-30"))
        self.assertEqual(result["bad_action_date"], 1)
        result = self.inspect(dict(self.row, sd="2026-12-01"))
        self.assertEqual(result["future_action_date"], 1)
        result = self.inspect(dict(self.row, sd="2025-12-31"))
        self.assertEqual(result["action_before_introduction"], 1)

    def test_invalid_source_duplicate_and_count_mismatch(self):
        row = dict(self.row, u="http://example.com/bill")
        doc = {"count": 1, "source_url": "", "rows": [row, row]}
        result = audit.audit_document("jp", doc)
        self.assertEqual(result["bad_url"], 2)
        self.assertEqual(result["duplicate_id"], 1)
        self.assertEqual(result["count_mismatch"], 1)
        self.assertEqual(result["missing_corpus_source"], 1)

    def test_missing_rows_is_fatal_not_silently_empty(self):
        with self.assertRaises(ValueError):
            audit.audit_document("jp", {"count": 0})


if __name__ == "__main__":
    unittest.main()
