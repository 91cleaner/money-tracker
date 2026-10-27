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


    def test_queue_cursor_rotates_and_wraps_without_skipping_last(self):
        rows = [{"id": str(i)} for i in range(1, 6)]
        first = ptr.select_records(rows, {}, 2)
        self.assertEqual([r["id"] for r in first], ["1", "2"])
        second = ptr.select_records(rows, {"last_attempted_filing_id": "2"}, 2)
        self.assertEqual([r["id"] for r in second], ["3", "4"])
        third = ptr.select_records(rows, {"last_attempted_filing_id": "4"}, 2)
        self.assertEqual([r["id"] for r in third], ["5", "1"])
        self.assertEqual([r["id"] for r in ptr.select_records(rows, {"last_attempted_filing_id": "missing"}, 2)], ["1", "2"])

    def test_queue_cursor_resumes_from_legacy_status(self):
        rows = [{"id": str(i)} for i in range(1, 4)]
        previous = {"filings": [{"filing_id": "1"}, {"filing_id": "2"}]}
        self.assertEqual([r["id"] for r in ptr.select_records(rows, previous, 2)], ["3", "1"])
        self.assertEqual(ptr.select_records([], previous, 2), [])
        with self.assertRaises(ValueError):
            ptr.select_records("bad payload", previous, 2)

    def test_main_persists_cursor_across_scheduled_runs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            queue, output, status = (root / x for x in ("queue.json", "candidates.json", "status.json"))
            rows = [{
                "id": "2026-" + str(i),
                "member": "Example Member",
                "filing_date": "10/20/2026",
                "document_url": "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/" + str(i) + ".pdf",
            } for i in range(1, 4)]
            queue.write_text(json.dumps({"records": rows}), encoding="utf-8")
            with patch.object(ptr, "QUEUE", queue), patch.object(ptr, "OUT", output), \\
                 patch.object(ptr, "STATUS", status), patch.object(ptr, "MAX_DOCS", 2), \\
                 patch.object(ptr.urllib.request, "urlopen", return_value=FakeResponse()), \\
                 patch.object(ptr, "extract", return_value=[]):
                ptr.main()
                first = json.loads(status.read_text(encoding="utf-8"))
                ptr.main()
                second = json.loads(status.read_text(encoding="utf-8"))
            self.assertEqual([x["filing_id"] for x in first["filings"]], ["2026-1", "2026-2"])
            self.assertEqual(first["last_attempted_filing_id"], "2026-2")
            self.assertEqual([x["filing_id"] for x in second["filings"]], ["2026-3", "2026-1"])
            self.assertEqual(second["last_attempted_filing_id"], "2026-1")


if __name__ == "__main__":
    unittest.main()
