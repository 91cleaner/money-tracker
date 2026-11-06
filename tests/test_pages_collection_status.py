"""Pre-publish regression tests for the public collector status file."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

CHECK = Path(__file__).resolve().parents[1] / "scripts/check-pages-artifact.py"
REQUIRED = (
    "index.html", "search.html", "national.html", "usa-command.html",
    "assets/se.js", "assets/mt-command-ui.js",
    "data/search/se/core.json", "data/national/countries-110m.geojson",
    "data/us/trades_public.json", "data/search/collection-status.json",
)

def status():
    return {
        "created_at": "2026-11-06T19:21:53.450Z",
        "pipeline": "official-public-no-ai",
        "collectors": {
            "us_federal_register": {"count": 133, "errors": []},
            "japan_diet": {"count": 46, "errors": []},
            "taiwan_legislature": {"count": 0, "errors": ["members: fetch failed"]},
            "us_sec": {"count": 80, "errors": []},
        },
    }

class PublicCollectionStatusTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in REQUIRED:
            p = self.root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text("{}" if name.endswith(".json") else "fixture", encoding="utf-8")
        self.trades = self.root / "data/us/trades_public.json"
        self.trades.write_text('{"trades":[]}', encoding="utf-8")
        self.path = self.root / "data/search/collection-status.json"

    def run_check(self, data, *, raw=False):
        self.path.write_text(data if raw else json.dumps(data), encoding="utf-8")
        return subprocess.run([sys.executable, str(CHECK), str(self.root)],
                              text=True, capture_output=True, check=False)

    def assert_rejected(self, data, *, raw=False):
        result = self.run_check(data, raw=raw)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("Invalid public collection-status.json", result.stderr)

    def test_valid_snapshot_preserves_taiwan_failure(self):
        result = self.run_check(status())
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_status_is_not_silent(self):
        self.path.unlink()
        result = subprocess.run([sys.executable, str(CHECK), str(self.root)],
                                text=True, capture_output=True, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("data/search/collection-status.json", result.stderr)

    def test_missing_collector_rejected(self):
        item = status()
        del item["collectors"]["taiwan_legislature"]
        self.assert_rejected(item)

    def test_missing_error_array_rejected(self):
        item = status()
        del item["collectors"]["taiwan_legislature"]["errors"]
        self.assert_rejected(item)

    def test_boolean_or_negative_count_rejected(self):
        for count in (True, -1, 1.5):
            with self.subTest(count=count):
                item = status()
                item["collectors"]["us_sec"]["count"] = count
                self.assert_rejected(item)

    def test_invalid_timestamp_rejected(self):
        for stamp in ("2026-11-06T19:21:53", "not-a-date"):
            with self.subTest(stamp=stamp):
                item = status()
                item["created_at"] = stamp
                self.assert_rejected(item)

    def test_wrong_pipeline_rejected(self):
        item = status()
        item["pipeline"] = "ai-live"
        self.assert_rejected(item)

    def test_duplicate_error_keys_cannot_hide_outage(self):
        raw = json.dumps(status()).replace('"errors": ["members: fetch failed"]',
                                          '"errors": ["members: fetch failed"], "errors": []')
        self.assert_rejected(raw, raw=True)

    def test_invalid_json_rejected(self):
        self.assert_rejected('{"collectors":', raw=True)

    def test_empty_error_string_rejected(self):
        item = status()
        item["collectors"]["us_sec"]["errors"] = [""]
        self.assert_rejected(item)

if __name__ == "__main__":
    unittest.main()
