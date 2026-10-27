"""House Clerk outages must not make a cached filing index look freshly collected."""
import contextlib
import datetime as dt
import json
import runpy
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "collect_house_filings.py"


class FakeResponse:
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self):
        return self.body


class HouseFilingArchiveTests(unittest.TestCase):
    def test_total_source_outage_preserves_prior_archive_and_timestamp(self):
        with tempfile.TemporaryDirectory() as tmp, contextlib.chdir(tmp):
            target = Path("data/us-house-filings.json")
            target.parent.mkdir()
            original = json.dumps({
                "collected_at": "2026-10-01T00:00:00+00:00",
                "records": [{"id": "2026-123", "member": "Existing"}],
            }) + "\n"
            target.write_text(original, encoding="utf-8")
            with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("offline")):
                with self.assertRaises(SystemExit) as error:
                    runpy.run_path(str(SCRIPT), run_name="__main__")
            self.assertIn("downloads failed", str(error.exception))
            self.assertEqual(target.read_text(encoding="utf-8"), original)

    def test_total_source_outage_does_not_create_empty_archive(self):
        with tempfile.TemporaryDirectory() as tmp, contextlib.chdir(tmp):
            with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("offline")):
                with self.assertRaises(SystemExit):
                    runpy.run_path(str(SCRIPT), run_name="__main__")
            self.assertFalse(Path("data/us-house-filings.json").exists())

    def test_one_successful_year_publishes_records_and_reports_other_failure(self):
        current_year = dt.datetime.now(dt.timezone.utc).year
        xml = (b"<Root><Member><DocID>123</DocID><FilingType>P</FilingType>"
               b"<First>Example</First><Last>Member</Last>"
               b"<FilingDate>10/20/2026</FilingDate></Member></Root>")

        def fetch(request, timeout=35):
            if f"/{current_year}FD.xml" in request.full_url:
                return FakeResponse(xml)
            raise urllib.error.URLError("other year unavailable")

        with tempfile.TemporaryDirectory() as tmp, contextlib.chdir(tmp):
            with patch("urllib.request.urlopen", side_effect=fetch):
                runpy.run_path(str(SCRIPT), run_name="__main__")
            result = json.loads(Path("data/us-house-filings.json").read_text(encoding="utf-8"))
            self.assertEqual(len(result["records"]), 1)
            self.assertEqual(result["records"][0]["id"], f"{current_year}-123")
            self.assertEqual(len(result["errors"]), 1)
            self.assertTrue(result["collected_at"])


if __name__ == "__main__":
    unittest.main()
