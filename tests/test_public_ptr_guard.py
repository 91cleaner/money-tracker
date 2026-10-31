"""Release regression: impossible or unsourced PTR rows cannot reach public Pages."""
import json
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "scripts"))
from public_ptr_guard import invalid_rows, sanitize_file

PDF = "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035710.pdf"


def record(**updates):
    return {"who": "Example Member", "tk": "ABC", "d": "2026-10-20",
            "fd": "2026-10-25", "doc": PDF, **updates}


class PublicPtrGuardTests(unittest.TestCase):
    def test_valid_snapshot_is_not_modified(self):
        data = {"updated": "2026-10-28", "trades": [record()]}
        with tempfile.TemporaryDirectory() as td:
            path = pathlib.Path(td) / "trades-recent.json"
            original = json.dumps(data)
            path.write_text(original)
            self.assertEqual(sanitize_file(path), (1, 0))
            self.assertEqual(path.read_text(), original)

    def test_quarantines_reversed_dates_without_changing_source(self):
        bad = record(d="2026-10-28", fd="2026-10-27")
        data = {"updated": "2026-10-28", "note": "delayed filing", "trades": [record(), bad]}
        with tempfile.TemporaryDirectory() as td:
            source = pathlib.Path(td) / "source.json"
            public = pathlib.Path(td) / "public.json"
            original = json.dumps(data)
            source.write_text(original)
            public.write_text(original)
            self.assertEqual(sanitize_file(public), (1, 1))
            output = json.loads(public.read_text())
            self.assertEqual(output["trades"], [record()])
            self.assertIn("1건 제외", output["note"])
            self.assertEqual(source.read_text(), original)
            self.assertEqual(invalid_rows(output), [])

    def test_rejects_future_filing_invalid_dates_and_spoofed_pdf(self):
        bad = [record(fd="2026-10-29"), record(d="2026-02-30"),
               record(doc="https://disclosures-clerk.house.gov.evil.test/public_disc/ptr-pdfs/2026/20035710.pdf"),
               record(doc="http://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035710.pdf")]
        errors = invalid_rows({"updated": "2026-10-28", "trades": [record()] + bad})
        self.assertEqual([i for i, _ in errors], [1, 2, 3, 4])

    def test_all_invalid_or_missing_snapshot_fails_closed(self):
        with tempfile.TemporaryDirectory() as td:
            path = pathlib.Path(td) / "trades-recent.json"
            path.write_text(json.dumps({"updated": "2026-10-28", "trades": [record(fd="2026-10-29")]}))
            with self.assertRaisesRegex(ValueError, "All House PTR rows invalid"):
                sanitize_file(path)
            self.assertEqual(len(json.loads(path.read_text())["trades"]), 1)
        for data in ({"updated": "2026-10-28", "trades": []},
                     {"updated": "invalid", "trades": [record()]},
                     {"trades": [record()]}):
            with self.subTest(data=data), self.assertRaises(ValueError):
                invalid_rows(data)


if __name__ == "__main__":
    unittest.main()
