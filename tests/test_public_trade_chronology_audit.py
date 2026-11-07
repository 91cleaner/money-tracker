"""Tests for read-only PTR anomaly triage (no private filing text in logs)."""
from datetime import date
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/audit-public-trade-chronology.py"
spec = importlib.util.spec_from_file_location("ptr_chronology_audit", SCRIPT)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def trade(**overrides):
    row = {
        "d": "2026-10-20", "fd": "2026-10-21", "filed": "2026-10-22",
        "doc": "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035778.pdf",
    }
    row.update(overrides)
    return row


class PublicTradeChronologyAuditTests(unittest.TestCase):
    def test_valid_house_and_senate_filing(self):
        senate = trade(doc="https://efdsearch.senate.gov/search/view/ptr/example/")
        self.assertEqual(audit.audit_rows([trade(), senate], date(2026, 11, 8)), {})

    def test_reports_multiple_anomalies_not_just_first_row(self):
        rows = [
            trade(d="2099-01-01", fd="2026-10-19", filed="2026-10-18"),
            trade(doc="https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2025/abc.pdf"),
            trade(fd="2026-02-30"),
            trade(filed="2026-10-19"),
        ]
        problems = audit.audit_rows(rows, date(2026, 11, 8))
        self.assertEqual(problems["future-transaction-date"], [0])
        self.assertEqual(problems["filing-predates-transaction"], [0])
        self.assertEqual(problems["submission-predates-transaction"], [0, 3])
        self.assertEqual(problems["archive-predates-transaction"], [0, 1])
        self.assertEqual(problems["invalid-filing-date"], [2])

    def test_malformed_rows_and_source_are_flagged(self):
        problems = audit.audit_rows([None, trade(doc="javascript:alert(1)"),
                                     trade(d="2026-2-2")], date(2026, 11, 8))
        self.assertEqual(problems["invalid-row"], [0])
        self.assertEqual(problems["invalid-filing-url"], [1])
        self.assertEqual(problems["invalid-transaction-date"], [2])

    def test_filing_urls_rejected_before_urlsplit_normalizes_controls(self):
        house = trade()["doc"]
        senate = "https://efdsearch.senate.gov/search/view/ptr/example/"
        bad_urls = [
            "\n" + house, "\t" + senate, house + "\r", house + " ",
            house + "`", house.replace("https://", "https://user:secret@"),
        ]
        problems = audit.audit_rows([trade(doc=url) for url in bad_urls],
                                    date(2026, 11, 8))
        self.assertEqual(problems["invalid-filing-url"], list(range(len(bad_urls))))

    def test_cli_reports_only_indices_not_secret_or_member_text(self):
        secret = "api_key=DO_NOT_ECHO_123456789"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "ledger.json"
            path.write_text(json.dumps({"trades": [
                trade(d="2099-01-01", who=secret, doc="https://user:" + secret + "@example.com/a")
            ]}), encoding="utf-8")
            result = subprocess.run([sys.executable, str(SCRIPT), str(path)],
                                    capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 1)
        self.assertIn("future-transaction-date: 1", result.stdout)
        self.assertNotIn(secret, result.stdout + result.stderr)

    def test_duplicate_json_keys_are_not_silently_audited(self):
        # json.loads normally keeps the last value. That could report zero
        # anomalies for a ledger rejected by the actual Pages release gate.
        secret = "api_key=DO_NOT_ECHO_123456789"
        payloads = (
            '{"trades":[{"d":"2099-01-01"}],"trades":[]}',
            '{"trades":[],"' + secret + '":1,"' + secret + '":2}',
        )
        for payload in payloads:
            with self.subTest(payload_length=len(payload)):
                with tempfile.TemporaryDirectory() as directory:
                    path = Path(directory) / "ledger.json"
                    path.write_text(payload, encoding="utf-8")
                    result = subprocess.run([sys.executable, str(SCRIPT), str(path)],
                                            capture_output=True, text=True, check=False)
                self.assertEqual(result.returncode, 2)
                self.assertIn("invalid or missing ledger", result.stderr)
                self.assertNotIn(secret, result.stdout + result.stderr)
                self.assertNotIn("0 anomalous rows", result.stdout)

    def test_nonfinite_json_numbers_are_not_accepted(self):
        # JSON NaN/Infinity and overflowing exponents are not valid finite
        # public numbers, even if Python's decoder accepts them by default.
        for number in ("NaN", "Infinity", "-Infinity", "1e309"):
            with self.subTest(number=number):
                with tempfile.TemporaryDirectory() as directory:
                    path = Path(directory) / "ledger.json"
                    path.write_text('{"trades":[],"updated":' + number + '}',
                                    encoding="utf-8")
                    result = subprocess.run([sys.executable, str(SCRIPT), str(path)],
                                            capture_output=True, text=True, check=False)
                self.assertEqual(result.returncode, 2)
                self.assertIn("invalid or missing ledger", result.stderr)
                self.assertNotIn(number, result.stdout + result.stderr)

    def test_missing_file_fails_without_echoing_path(self):
        result = subprocess.run([sys.executable, str(SCRIPT), "/tmp/not-found-public-ptr-audit.json"],
                                capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 2)
        self.assertNotIn("/tmp/not-found-public-ptr-audit.json", result.stderr)


if __name__ == "__main__":
    unittest.main()
