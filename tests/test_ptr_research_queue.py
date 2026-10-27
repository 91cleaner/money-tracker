"""Date-order and provenance regression checks for the official House PTR queue."""
import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_ptr_research_queue.py"
spec = importlib.util.spec_from_file_location("build_ptr_research_queue", SCRIPT)
queue = importlib.util.module_from_spec(spec)
spec.loader.exec_module(queue)


def filing(fid, when, kind="P", url=None, member="Example Member"):
    return {
        "id": fid, "member": member, "filing_date": when, "filing_type": kind,
        "document_url": url or
        ("https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/" + fid + ".pdf"),
    }


class PtrQueueTests(unittest.TestCase):
    def test_calendar_sort_prevents_september_burying_october(self):
        rows = [
            filing("101", "9/9/2026"),
            filing("102", "10/21/2026"),
            filing("103", "1/2/2026"),
            filing("104", "2026-10-22"),
            filing("105", "12/31/2025"),
        ]
        result = queue.build_queue({"records": rows, "collected_at": "2026-10-28"}, limit=3)
        self.assertEqual([x["id"] for x in result["records"]], ["104", "102", "101"])
        self.assertEqual(result["count"], 5)
        self.assertTrue(all(x["status"] == "awaiting_pdf_review" for x in result["records"]))
        self.assertIn("not a verified transaction", result["caveat"])

    def test_invalid_and_non_ptr_rows_are_not_promoted(self):
        rows = [
            filing("201", "13/1/2026"),
            filing("202", "", member="Example Member"),
            filing("203", "10/22/2026", kind="A"),
            filing("204", "10/22/2026", member=""),
            filing("205", "10/22/2026", url="https://example.com/fake.pdf"),
            filing("206", "10/22/2026"),
        ]
        result = queue.build_queue({"records": rows})
        self.assertEqual([x["id"] for x in result["records"]], ["206"])
        self.assertEqual(result["count"], 1)

    def test_duplicate_pdf_keeps_newest_metadata(self):
        url = "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/301.pdf"
        rows = [filing("301", "9/9/2026", url=url),
                filing("301", "10/22/2026", url=url)]
        result = queue.build_queue({"records": rows})
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["records"][0]["filing_date"], "10/22/2026")

    def test_invalid_source_shape_fails_closed(self):
        with self.assertRaises(ValueError):
            queue.build_queue({"records": "not a list"})


if __name__ == "__main__":
    unittest.main()
