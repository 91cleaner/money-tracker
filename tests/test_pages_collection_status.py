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

    def test_preflight_watches_public_data_and_builder_changes(self):
        # A PR or direct main push changing public data or its builder must
        # run the standalone preflight, not only changes to the validator.
        workflow = (Path(__file__).resolve().parents[1]
                    / ".github/workflows/pages-collection-status-preflight.yml").read_text(encoding="utf-8")
        pr_paths = workflow.split("  pull_request:\n", 1)[1].split("  push:\n", 1)[0]
        push_paths = workflow.split("  push:\n", 1)[1].split("  workflow_dispatch:", 1)[0]
        for path in (
            "data/search/collection-status.json",
            "data/us/trades_public.json",
            "scripts/prepare-public-pages.py",
            "scripts/build_public_trades.py",
        ):
            with self.subTest(path=path):
                marker = "      - '" + path + "'"
                self.assertIn(marker, pr_paths)
                self.assertIn(marker, push_paths)

    def test_valid_snapshot_preserves_taiwan_failure(self):
        result = self.run_check(status())
        self.assertEqual(result.returncode, 0, result.stderr)

    def assert_trades_rejected(self, content):
        self.trades.write_text(content, encoding="utf-8")
        result = self.run_check(status())
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("Invalid public trades_public.json", result.stderr)

    def test_missing_public_trades_array_is_not_reported_as_zero(self):
        self.assert_trades_rejected("{}")

    def test_wrong_public_trades_type_is_rejected(self):
        for bad in ('{"trades":null}', '{"trades":{}}', '{"trades":"none"}'):
            with self.subTest(bad=bad):
                self.assert_trades_rejected(bad)

    def test_non_object_public_trade_rows_are_rejected(self):
        for bad in ('{"trades":[null]}', '{"trades":[42]}', '{"trades":["fake"]}'):
            with self.subTest(bad=bad):
                self.assert_trades_rejected(bad)

    def test_unapproved_public_trade_fields_are_rejected(self):
        self.assert_trades_rejected('{"trades":[{"who":"test","private_note":"not public"}]}')

    def test_duplicate_public_trade_keys_cannot_hide_a_ledger(self):
        self.assert_trades_rejected('{"trades":[{"who":"test"}],"trades":[]}')

    def test_malformed_public_trade_json_is_rejected(self):
        self.assert_trades_rejected('{"trades":')

    def test_nested_public_trade_values_cannot_smuggle_private_fields(self):
        for bad in (
            '{"trades":[{"who":{"name":"test","private_email":"hidden"}}]}',
            '{"trades":[{"doc":["https://example.org/filing"]}]}',
        ):
            with self.subTest(bad=bad):
                self.assert_trades_rejected(bad)

    def test_boolean_and_null_public_trade_values_are_rejected(self):
        for bad in (
            '{"trades":[{"r":true}]}',
            '{"trades":[{"who":null}]}',
        ):
            with self.subTest(bad=bad):
                self.assert_trades_rejected(bad)

    def test_nested_public_ledger_metadata_is_rejected(self):
        self.assert_trades_rejected('{"source":{"private_note":"hidden"},"trades":[]}')

    def test_numeric_overflow_is_not_a_public_trade_value(self):
        # Python json.loads turns 1e309 into float('inf') without invoking
        # parse_constant. The published ledger must contain finite numbers.
        for raw in (
            '{"trades":[{"r":1e309}]}',
            '{"trades":[{"rspy":-1e309}]}',
            '{"source":1e309,"trades":[]}',
        ):
            with self.subTest(raw=raw):
                self.assert_trades_rejected(raw)

    def test_nonstandard_numeric_constants_are_not_public_json(self):
        for raw in (
            '{"trades":[{"r":NaN}]}',
            '{"trades":[{"r":Infinity}]}',
            '{"trades":[{"rspy":-Infinity}]}',
        ):
            with self.subTest(raw=raw):
                self.assert_trades_rejected(raw)

    def test_unsafe_filing_urls_are_rejected_before_publication(self):
        # The doc field becomes a clickable source link in US views.
        for bad in (
            "javascript:alert(1)", "data:text/html,unsafe", "file:///etc/passwd",
            "//disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/a.pdf",
            "https://user:pass@example.org/filing.pdf",
            "https://example.org\\\\@evil.example/filing.pdf",
            "https://example.org/with space.pdf",
            "https://example.org/line\\nfeed.pdf",
            "https://",
        ):
            with self.subTest(doc=bad):
                self.assert_trades_rejected(
                    json.dumps({"trades": [{"who": "Test", "doc": bad}]})
                )

    def test_official_https_filing_url_and_absent_doc_are_allowed(self):
        self.trades.write_text(json.dumps({"trades": [
            {"who": "Test", "doc": "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035778.pdf"},
            {"who": "Unlinked filing"},
        ]}), encoding="utf-8")
        result = self.run_check(status())
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_scalar_public_trade_values_are_accepted(self):
        self.trades.write_text(
            '{"source":"official-filing","updated":null,"trades":'
            '[{"who":"Test","ty":"Purchase","r":1.25,"amt":"$1,001-$15,000"}]}',
            encoding="utf-8",
        )
        result = self.run_check(status())
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_sec_not_configured_is_explicit_not_a_successful_zero(self):
        item = status()
        item["collectors"]["us_sec"] = {"status": "not-configured", "count": 0}
        result = self.run_check(item)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_invalid_taiwan_term_is_explicit_not_a_successful_zero(self):
        item = status()
        item["collectors"]["taiwan_legislature"] = {"status": "invalid-term", "count": 0}
        result = self.run_check(item)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_fatal_upstream_failure_keeps_error_visible(self):
        item = status()
        item["collectors"]["taiwan_legislature"] = {"status": "failed", "error": "HTTP 503"}
        result = self.run_check(item)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_fatal_failure_without_meaningful_error_rejected(self):
        for bad in ({"status": "failed"}, {"status": "failed", "error": ""}):
            with self.subTest(bad=bad):
                item = status()
                item["collectors"]["us_sec"] = bad
                self.assert_rejected(item)

    def test_invalid_or_mismatched_explicit_state_rejected(self):
        for bad in ({"status": "unknown", "count": 0},
                    {"status": "not-configured", "count": 1},
                    {"status": "invalid-term", "count": 0}):
            with self.subTest(bad=bad):
                item = status()
                item["collectors"]["us_sec"] = bad
                self.assert_rejected(item)

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

    def test_future_timestamp_rejected(self):
        for stamp in ("2099-01-01T00:00:00Z", "2099-01-01T00:00:00+14:00"):
            with self.subTest(stamp=stamp):
                item = status()
                item["created_at"] = stamp
                self.assert_rejected(item)

    def test_equivalent_timezone_offset_accepted(self):
        item = status()
        item["created_at"] = "2026-11-06T20:21:53.450+01:00"
        result = self.run_check(item)
        self.assertEqual(result.returncode, 0, result.stderr)

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
