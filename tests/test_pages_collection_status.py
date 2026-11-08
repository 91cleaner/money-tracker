"""Pre-publish regression tests for the public collector status file."""
import json
from datetime import datetime, timedelta, timezone
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

def public_trade(**overrides):
    row = {
        "who": "Example Member",
        "asset": "Example Holdings",
        "ty": "P",
        "d": "2026-10-20",
        "amt": "$1,001 - $15,000",
        "doc": "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035778.pdf",
    }
    row.update(overrides)
    return row


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

    def test_empty_trade_object_is_not_a_reported_transaction(self):
        # A zero-row ledger is legitimate; an object with no transaction
        # fields must not be counted as one reported transaction.
        self.assert_trades_rejected('{"trades":[{}]}')
        self.trades.write_text('{"trades":[]}', encoding="utf-8")
        result = self.run_check(status())
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_public_trade_text_cannot_ship_markup_or_credentials(self):
        for key, value in (
            ("who", "<img src=x onerror=alert(1)>"),
            ("asset", "Example <script>alert(1)</script>"),
            ("amt", "Authorization: Bearer test_secret_1234567890"),
            ("doc", "https://disclosures-clerk.house.gov/?api_key=secret123456789"),
        ):
            with self.subTest(field=key):
                self.assert_trades_rejected(
                    json.dumps({"trades": [public_trade(**{key: value})]}))

    def test_public_ptr_text_rejects_terminal_and_bidi_controls(self):
        # Filing fields are rendered in public pages; escaped JSON controls
        # must not become terminal escapes or misleading display text.
        for bad in ("\x00", "\x1b[31m", "\n", "\u202e", "\u2066"):
            with self.subTest(control=repr(bad)):
                self.assert_trades_rejected(json.dumps({
                    "trades": [public_trade(who="Member" + bad + "Name")]
                }))

    def test_public_status_errors_reject_terminal_and_bidi_controls(self):
        # Prevent multiline/ANSI log injection and bidirectional text spoofing
        # while preserving ordinary non-ASCII diagnostics.
        for bad in ("\x00", "\x1b[31m", "\r", "\u202e", "\u2066"):
            with self.subTest(control=repr(bad)):
                item = status()
                item["collectors"]["taiwan_legislature"]["errors"] = [
                    "members: fetch failed" + bad
                ]
                self.assert_rejected(item)

    def test_public_ledger_metadata_cannot_ship_credentials(self):
        for field, value in (
            ("source", "client_secret=private123456"),
            ("note", "<svg/onload=alert(1)>"),
        ):
            with self.subTest(field=field):
                self.assert_trades_rejected(
                    json.dumps({field: value, "trades": []}))

    def test_legitimate_public_filing_text_still_passes(self):
        self.trades.write_text(json.dumps({
            "source": "Official STOCK Act filings",
            "note": "Amounts are reported ranges, not profits.",
            "trades": [{
                "who": "Example & Co.",
                "asset": "Example Holdings (Class A)",
                "ty": "Purchase",
                "d": "2026-10-20",
                "amt": "$1,001-$15,000",
                "doc": "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035778.pdf"
            }]
        }), encoding="utf-8")
        result = self.run_check(status())
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_unapproved_public_trade_fields_are_rejected(self):
        self.assert_trades_rejected('{"trades":[{"who":"test","private_note":"not public"}]}')

    def test_unknown_public_trade_key_names_never_echo_credentials(self):
        # Rejected object keys are untrusted just like duplicate keys.
        # The CI diagnostic must not reveal their contents.
        secret = "api_key=do_not_echo_123456789"
        for payload in (
            {"trades": [], secret: "private"},
            {"trades": [public_trade(**{secret: "private"})]},
        ):
            with self.subTest(top_level=secret in payload):
                self.trades.write_text(json.dumps(payload), encoding="utf-8")
                result = self.run_check(status())
                self.assertNotEqual(result.returncode, 0, result.stdout)
                self.assertIn("Invalid public trades_public.json", result.stderr)
                self.assertNotIn(secret, result.stderr)

    def test_future_dated_trade_is_not_a_historical_filing(self):
        # House/Senate filing dates are US-local, never a calendar day ahead
        # of UTC. Tomorrow must not be treated as a completed trade.
        future = (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()
        for bad in (future, "2099-01-01"):
            with self.subTest(date=bad):
                self.assert_trades_rejected(
                    json.dumps({"trades": [public_trade(d=bad)]}))

    def test_current_utc_day_trade_is_not_rejected_as_future(self):
        # Preserve valid same-day US PTR records at the UTC date boundary.
        today = datetime.now(timezone.utc).date().isoformat()
        self.trades.write_text(json.dumps({
            "trades": [public_trade(d=today)]
        }), encoding="utf-8")
        result = self.run_check(status())
        self.assertEqual(result.returncode, 0, result.stderr)

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
            "https://example.org/line\nfeed.pdf",
            "https://",
        ):
            with self.subTest(doc=bad):
                self.assert_trades_rejected(
                    json.dumps({"trades": [public_trade(doc=bad)]})
                )

    def test_filing_urls_cannot_break_out_of_html_attributes(self):
        # URL parsing alone accepts raw HTML/JS delimiters. These links may
        # be interpolated into quoted attributes by downstream public views.
        for bad in (
            'https://disclosures-clerk.house.gov/a"onclick=alert(1)',
            "https://disclosures-clerk.house.gov/a'onclick=alert(1)",
            "https://disclosures-clerk.house.gov/<svg/onload=alert(1)>",
            "https://disclosures-clerk.house.gov/a" + chr(96) + "onload=alert(1)",
        ):
            with self.subTest(doc=bad):
                self.assert_trades_rejected(json.dumps({"trades": [public_trade(doc=bad)]}))

    def test_official_house_and_senate_filing_links_are_accepted(self):
        self.trades.write_text(json.dumps({"trades": [
            public_trade(),
            public_trade(doc="https://efdsearch.senate.gov/search/view/ptr/example/"),
        ]}), encoding="utf-8")
        result = self.run_check(status())
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_trade_requires_verifiable_core_filing_fields(self):
        for field in ("who", "asset", "ty", "d", "amt", "doc"):
            with self.subTest(missing=field):
                row = public_trade()
                del row[field]
                self.assert_trades_rejected(json.dumps({"trades": [row]}))
            with self.subTest(blank=field):
                self.assert_trades_rejected(
                    json.dumps({"trades": [public_trade(**{field: "   "})]}))

    def test_invalid_transaction_calendar_dates_are_rejected(self):
        for bad in ("2026-02-30", "2026-13-01", "10/20/2026", "2026-1-2"):
            with self.subTest(date=bad):
                self.assert_trades_rejected(
                    json.dumps({"trades": [public_trade(d=bad)]}))

    def test_unofficial_and_insecure_filing_sources_are_rejected(self):
        for bad in (
            "https://disclosures-clerk.house.gov.evil.example/ptr.pdf",
            "https://third-party.example/ptr.pdf",
            "http://disclosures-clerk.house.gov/ptr.pdf",
            "https://efdsearch.senate.gov.evil.example/ptr.pdf",
        ):
            with self.subTest(doc=bad):
                self.assert_trades_rejected(
                    json.dumps({"trades": [public_trade(doc=bad)]}))

    def test_official_host_without_actual_ptr_filing_is_rejected(self):
        # An official domain alone is insufficient: homepages, unrelated
        # pages and nonstandard ports cannot verify a transaction.
        for bad in (
            "https://disclosures-clerk.house.gov/",
            "https://disclosures-clerk.house.gov/public_disc/",
            "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/",
            "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/not-a-pdf",
            "https://efdsearch.senate.gov/",
            "https://efdsearch.senate.gov/search/",
            "https://disclosures-clerk.house.gov:4443/public_disc/ptr-pdfs/2026/20035778.pdf",
            "https://disclosures-clerk.house.gov:bad/public_disc/ptr-pdfs/2026/20035778.pdf",
            "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035778.pdf?token=x",
            "https://efdsearch.senate.gov/search/view/ptr/example/#unverified",
        ):
            with self.subTest(doc=bad):
                self.assert_trades_rejected(
                    json.dumps({"trades": [public_trade(doc=bad)]}))

    def test_filing_date_cannot_precede_transaction(self):
        # A 2026-02 filing cannot verify a transaction dated 2026-12.
        # The original source may contain a typo; never infer a correction.
        self.assert_trades_rejected(json.dumps({
            "trades": [public_trade(d="2026-10-20", fd="2026-10-19")]
        }))

    def test_malformed_or_future_filing_date_is_rejected(self):
        for bad in ("2026-02-30", "2026-1-2", "2099-01-01", 20261105):
            with self.subTest(fd=bad):
                self.assert_trades_rejected(json.dumps({
                    "trades": [public_trade(fd=bad)]
                }))

    def test_valid_late_filing_date_remains_accepted(self):
        self.trades.write_text(json.dumps({
            "trades": [public_trade(fd="2026-11-05")]
        }), encoding="utf-8")
        result = self.run_check(status())
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_submission_date_cannot_precede_transaction(self):
        # filed is the actual submission date, distinct from fd. A plausible
        # fd must not mask a report supposedly filed before its transaction.
        self.assert_trades_rejected(json.dumps({
            "trades": [public_trade(
                d="2026-10-20", fd="2026-10-20", filed="2026-10-19")]
        }))

    def test_invalid_or_future_submission_date_is_rejected(self):
        for bad in ("2026-02-30", "2026-1-2", "2099-01-01", 20261105):
            with self.subTest(filed=bad):
                self.assert_trades_rejected(json.dumps({
                    "trades": [public_trade(filed=bad)]
                }))

    def test_valid_submission_does_not_require_ordering_against_fd(self):
        # The two filing-related fields have different meanings; do not
        # mistake an fd later than filed for an invalid submission.
        self.trades.write_text(json.dumps({
            "trades": [public_trade(
                d="2026-10-20", fd="2026-11-05", filed="2026-10-21")]
        }), encoding="utf-8")
        result = self.run_check(status())
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_house_ptr_archive_chronology_is_verified(self):
        # A House PDF archive year is the filing year, not a substitute for
        # the transaction date. A report cannot be filed before its trade.
        for archive_year in ("2025", "2099"):
            with self.subTest(archive_year=archive_year):
                self.assert_trades_rejected(json.dumps({
                    "trades": [public_trade(
                        d="2026-10-20",
                        doc=("https://disclosures-clerk.house.gov/"
                             f"public_disc/ptr-pdfs/{archive_year}/20035778.pdf"),
                    )]
                }))

    def test_house_ptr_late_filing_archive_remains_valid(self):
        # A 2025 trade may legitimately appear in a 2026 filing archive.
        self.trades.write_text(json.dumps({
            "trades": [public_trade(d="2025-10-20")]
        }), encoding="utf-8")
        result = self.run_check(status())
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_only_approved_public_ptr_review_states_are_published(self):
        # Pending builder #504 retains these source-review labels. A release
        # gate must preserve them rather than reject all verification fields.
        rows = [public_trade(verification=value) for value in (
            "machine_parsed_requires_review",
            "verified_against_original",
            "unknown",
        )]
        self.trades.write_text(json.dumps({"trades": rows}), encoding="utf-8")
        result = self.run_check(status())
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_public_ptr_review_field_cannot_publish_internal_notes(self):
        for bad in (
            "verified by private analyst@example.com",
            "approved",
            "",
            {"reviewer": "private"},
        ):
            with self.subTest(verification=bad):
                self.assert_trades_rejected(json.dumps({
                    "trades": [public_trade(verification=bad)]
                }))

    def test_scalar_public_trade_values_are_accepted(self):
        self.trades.write_text(json.dumps({
            "source": "official-filing", "updated": None,
            "trades": [public_trade(r=1.25)],
        }), encoding="utf-8")
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

    def test_non_rfc3339_timestamps_are_rejected(self):
        # Python datetime.fromisoformat accepts these, but the collector
        # contract requires a T separator and minute-precision UTC offset.
        for stamp in (
            "2026-11-06X19:21:53+00:00",
            "2026-11-06 19:21:53Z",
            "2026-11-06T19:21:53+00:00:30",
            "2026-11-06T19:21:53+00:00:00",
        ):
            with self.subTest(stamp=stamp):
                item = status()
                item["created_at"] = stamp
                self.assert_rejected(item)

    def test_rfc3339_timestamp_with_fraction_and_offset_is_accepted(self):
        for stamp in (
            "2026-11-06T19:21:53Z",
            "2026-11-06T19:21:53.450Z",
            "2026-11-06T20:21:53.450+01:00",
        ):
            with self.subTest(stamp=stamp):
                item = status()
                item["created_at"] = stamp
                result = self.run_check(item)
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_invalid_timestamp_never_echoes_credentials_to_ci_logs(self):
        # datetime.fromisoformat includes its input in ValueError; public CI
        # must not echo a token hidden in malformed upstream timestamps.
        for secret in (
            "api_key=do_not_echo_123456789",
            "Authorization: Bearer test_secret_1234567890",
        ):
            with self.subTest(secret=secret):
                item = status()
                item["created_at"] = secret
                result = self.run_check(item)
                self.assertNotEqual(result.returncode, 0, result.stdout)
                self.assertIn("Invalid public collection-status.json", result.stderr)
                self.assertIn("invalid created_at timestamp", result.stderr)
                self.assertNotIn(secret, result.stderr)

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

    def test_duplicate_keys_never_echo_secrets_in_ci_logs(self):
        # GitHub Actions logs are readable for this public repository. Even a
        # rejected malicious JSON key must never be echoed into those logs.
        secret = "api_key=do_not_echo_123456789"
        raw = json.dumps(status()).replace(
            '"pipeline":', f'"{secret}": 1, "{secret}": 2, "pipeline":', 1)
        result = self.run_check(raw, raw=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Invalid public collection-status.json", result.stderr)
        self.assertNotIn(secret, result.stderr)

        self.trades.write_text(
            f'{{"trades": [], "{secret}": 1, "{secret}": 2}}',
            encoding="utf-8",
        )
        result = self.run_check(status())
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Invalid public trades_public.json", result.stderr)
        self.assertNotIn(secret, result.stderr)

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

    def test_collector_errors_never_publish_credentials(self):
        # The collector status JSON is public. Upstream exception strings can
        # accidentally include request headers, URL query keys or credentials.
        leaked = (
            "Authorization: Bearer test_secret_1234567890",
            "GET https://api.example.org/?api_key=secret123456",
            "password=not-for-publication",
            "request failed ghp_1234567890abcdefghijkl",
            "client_secret=very-private-value",
        )
        for message in leaked:
            with self.subTest(message=message):
                item = status()
                item["collectors"]["taiwan_legislature"]["errors"] = [message]
                self.assert_rejected(item)
                item = status()
                item["collectors"]["taiwan_legislature"] = {
                    "status": "failed", "error": message,
                }
                self.assert_rejected(item)

    def test_collector_error_query_and_header_tokens_rejected(self):
        # Upstream HTTP errors can echo URL query credentials and auth headers.
        # These variants were not covered by the original API-key-only filter.
        leaked = (
            "GET https://api.example.org/?token=very_private_value_123",
            "GET https://api.example.org/?key=very_private_value_123",
            "GET https://api.example.org/?apiKey=very_private_value_123",
            "X-Auth-Token: very_private_value_123",
            "session_token=very_private_value_123",
            "GET https://service_user:password123@api.example.org/failed",
        )
        for message in leaked:
            with self.subTest(message=message):
                item = status()
                item["collectors"]["taiwan_legislature"]["errors"] = [message]
                self.assert_rejected(item)
                item["collectors"]["taiwan_legislature"] = {
                    "status": "failed", "error": message,
                }
                self.assert_rejected(item)

    def test_json_quoted_credentials_cannot_be_published(self):
        # Upstream HTTP exceptions can include JSON bodies. Quoted keys (and
        # escaped JSON in a nested error) previously bypassed key=value rules.
        leaked = (
            '{"api_key":"synthetic_private_123456"}',
            r'{\"client_secret\":\"synthetic_private_123456\"}',
            '{"Authorization":"synthetic_private_123456"}',
        )
        for message in leaked:
            with self.subTest(message=message):
                # Each subtest must start with a valid ledger: the previous
                # trade-metadata rejection leaves a deliberately bad fixture.
                self.trades.write_text('{"trades":[]}', encoding="utf-8")
                item = status()
                item["collectors"]["taiwan_legislature"]["errors"] = [message]
                self.assert_rejected(item)
                item["collectors"]["taiwan_legislature"] = {
                    "status": "failed", "error": message,
                }
                self.assert_rejected(item)
                self.assert_trades_rejected(json.dumps({
                    "note": message, "trades": [],
                }))
        self.trades.write_text('{"trades":[]}', encoding="utf-8")
        # Ordinary non-secret JSON diagnostic text remains usable.
        item = status()
        item["collectors"]["taiwan_legislature"]["errors"] = [
            '{"error":"upstream unavailable"}',
        ]
        result = self.run_check(item)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_public_trade_metadata_query_token_rejected(self):
        self.assert_trades_rejected(json.dumps({
            "note": "GET https://api.example.org/?token=private_token_123",
            "trades": [],
        }))

    def test_unknown_top_level_status_fields_cannot_publish_credentials(self):
        # Only created_at, pipeline and collectors belong in public status.
        item = status()
        item["access_token"] = "secret-not-for-publication"
        self.assert_rejected(item)

    def test_collector_names_cannot_smuggle_credentials_or_markup(self):
        # An arbitrary collector key is public JSON just like an error value.
        for name in (
            "Authorization: Bearer secret123456789",
            "api_key=secret123456789",
            "<img src=x onerror=alert(1)>",
            "taiwan-legislature",
        ):
            with self.subTest(name=name):
                item = status()
                item["collectors"][name] = {"count": 0, "errors": []}
                self.assert_rejected(item)

    def test_new_well_formed_collector_name_remains_allowed(self):
        # Keep future official sources extensible without arbitrary keys.
        item = status()
        item["collectors"]["korea_national_assembly"] = {"count": 0, "errors": []}
        result = self.run_check(item)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_collector_errors_cannot_publish_raw_html(self):
        item = status()
        item["collectors"]["taiwan_legislature"]["errors"] = [
            "upstream 503 <img src=x onerror=alert(1)>",
        ]
        self.assert_rejected(item)

    def test_plaintext_outage_diagnostics_remain_allowed(self):
        item = status()
        item["collectors"]["taiwan_legislature"]["errors"] = [
            "members: fetch failed", "HTTP 503: upstream unavailable",
            "API key not configured",
        ]
        result = self.run_check(item)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_encoded_credentials_and_markup_in_status_errors_are_rejected(self):
        # An upstream exception can hide sensitive query keys behind URL/HTML
        # escaping; the public JSON is copied verbatim into Pages.
        for bad in (
            "fetch failed: api%5Fkey%3Ddo_not_echo_123456789",
            "fetch failed: api%255Fkey%253Ddo_not_echo_123456789",
            "fetch failed: api&#95;key&#61;do_not_echo_123456789",
            "fetch failed: %3Cscript%3Ealert(1)%3C/script%3E",
            "fetch failed: &#x3C;img src=x onerror=alert(1)&#x3E;",
            "fetch failed: line%0Abreak",
        ):
            with self.subTest(encoded_error=bad[:32]):
                item = status()
                item["collectors"]["taiwan_legislature"]["errors"] = [bad]
                self.assert_rejected(item)
                item["collectors"]["taiwan_legislature"] = {
                    "status": "failed", "error": bad,
                }
                self.assert_rejected(item)

    def test_encoded_credentials_and_markup_in_public_trade_are_rejected(self):
        for field, value in (
            ("who", "Member%3Cscript%3Ealert(1)%3C/script%3E"),
            ("asset", "Company api%255Fkey%253Ddo_not_echo_123456789"),
            ("amt", "Amount &#x3C;img onerror=alert(1)&#x3E;"),
            ("source", "Official?token%3Ddo_not_echo_123456789"),
        ):
            with self.subTest(field=field):
                payload = {"trades": [public_trade()]}
                if field == "source":
                    payload[field] = value
                else:
                    payload["trades"][0][field] = value
                self.assert_trades_rejected(json.dumps(payload))

    def test_deeply_encoded_secrets_and_markup_are_rejected(self):
        # More than three nested URL encodings used to bypass the release gate.
        # Check both collector errors and the published filing text.
        for raw in ("token%3Dsynthetic_secret_123456789", "%3Cscript%3E"):
            for depth in (4, 8, 14):
                encoded = raw
                for _ in range(depth):
                    encoded = encoded.replace("%", "%25")
                with self.subTest(raw=raw, depth=depth):
                    item = status()
                    item["collectors"]["taiwan_legislature"]["errors"] = [
                        "fetch failed: " + encoded
                    ]
                    self.assert_rejected(item)
                    self.assert_trades_rejected(json.dumps({
                        "trades": [public_trade(who="Member " + encoded)]
                    }))
                    self.trades.write_text('{"trades":[]}', encoding="utf-8")

    def test_benign_encoded_diagnostics_remain_public(self):
        item = status()
        item["collectors"]["taiwan_legislature"]["errors"] = [
            "HTTP 404 path%2Fmissing", "timeout while reading &amp; retrying",
        ]
        result = self.run_check(item)
        self.assertEqual(result.returncode, 0, result.stderr)


    def test_cookie_headers_are_not_published_in_collector_errors_or_trade_metadata(self):
        # Upstream HTTP errors may include session cookies without using the
        # words token/password. Reject raw and URL-encoded Cookie headers.
        bad_messages = (
            "HTTP 503 Set-Cookie: sid=private_session_123456; Path=/",
            "HTTP 401 Cookie: sessionid=private_session_123456",
            "HTTP 503 Set%2DCookie%3A%20sid%3Dprivate_session_123456",
        )
        for message in bad_messages:
            with self.subTest(message=message[:24]):
                self.trades.write_text('{"trades":[]}', encoding="utf-8")
                item = status()
                item["collectors"]["taiwan_legislature"]["errors"] = [message]
                self.assert_rejected(item)
                item["collectors"]["taiwan_legislature"] = {
                    "status": "failed", "error": message,
                }
                self.assert_rejected(item)
                self.assert_trades_rejected(json.dumps({
                    "note": message, "trades": [],
                }))
        self.trades.write_text('{"trades":[]}', encoding="utf-8")
        item = status()
        item["collectors"]["taiwan_legislature"]["errors"] = [
            "HTTP 503: cookies disabled by upstream",
        ]
        result = self.run_check(item)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
