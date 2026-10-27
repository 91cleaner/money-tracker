"""Regression tests: never overwrite the 4,669-row legacy disclosure snapshot."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "extract_house_ptr.py"
spec = importlib.util.spec_from_file_location("extract_house_ptr", SCRIPT)
ptr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ptr)


class FakeResponse:
    headers = {"Content-Length": "12"}

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, _limit):
        return b"%PDF-test-pdf"


class HousePtrExtractionTests(unittest.TestCase):
    def test_candidate_output_is_not_legacy_disclosure_snapshot(self):
        self.assertNotEqual(ptr.OUT.name, "trades.json")
        self.assertEqual(ptr.OUT.name, "house-ptr-candidates.json")

    def test_separate_owner_and_pdf_row_provenance_are_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            queue = root / "queue.json"
            output = root / "house-ptr-candidates.json"
            status = root / "status.json"
            legacy = root / "trades.json"
            sentinel = '{"trades":[{"who":"legacy-member"}]}\n'
            legacy.write_text(sentinel, encoding="utf-8")
            record = {
                "id": "2026-12345",
                "member": "Example Member",
                "filing_date": "10/20/2026",
                "document_url": "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/12345.pdf",
            }
            queue.write_text(json.dumps({"records": [record]}), encoding="utf-8")
            base = {
                "member": record["member"], "filing_date": record["filing_date"],
                "transaction_date": "2026-10-10", "notification_date": "2026-10-11",
                "asset": "Example Corp", "type": "P", "amount_min_usd": 1001,
                "amount_max_usd": 15000, "source_pdf": record["document_url"],
                "filing_id": record["id"], "verification": "machine_parsed_requires_review",
            }
            rows = [
                dict(base, owner="Self", source_page=1, source_table=1, source_row=1),
                dict(base, owner="Spouse", source_page=1, source_table=1, source_row=2),
                dict(base, owner="Self", source_page=2, source_table=1, source_row=1),
            ]
            with patch.object(ptr, "QUEUE", queue), patch.object(ptr, "OUT", output), \
                 patch.object(ptr, "STATUS", status), patch.object(ptr, "MAX_DOCS", 1), \
                 patch.object(ptr.urllib.request, "urlopen", return_value=FakeResponse()), \
                 patch.object(ptr, "extract", return_value=rows):
                ptr.main()
                ptr.main()  # rerun must not duplicate the same PDF rows
            self.assertEqual(legacy.read_text(encoding="utf-8"), sentinel)
            data = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(len(data["records"]), 3)
            self.assertEqual({r["owner"] for r in data["records"]}, {"Self", "Spouse"})
            self.assertTrue(all(r["verification"] == "machine_parsed_requires_review" for r in data["records"]))

    def test_no_candidates_does_not_erase_prior_candidate_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            queue, output, status = (root / x for x in ("queue.json", "candidates.json", "status.json"))
            queue.write_text(json.dumps({"records": [{
                "id": "2026-12345", "document_url":
                "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/12345.pdf",
            }]}), encoding="utf-8")
            output.write_text('{"records":[{"asset":"saved"}]}', encoding="utf-8")
            with patch.object(ptr, "QUEUE", queue), patch.object(ptr, "OUT", output), \
                 patch.object(ptr, "STATUS", status), patch.object(ptr, "MAX_DOCS", 1), \
                 patch.object(ptr.urllib.request, "urlopen", return_value=FakeResponse()), \
                 patch.object(ptr, "extract", return_value=[]):
                ptr.main()
            self.assertEqual(json.loads(output.read_text(encoding="utf-8"))["records"][0]["asset"], "saved")


if __name__ == "__main__":
    unittest.main()
