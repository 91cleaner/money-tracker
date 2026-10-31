"""Release regression: impossible or unsourced PTR rows cannot reach public Pages."""
import json
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "scripts"))
from public_ptr_guard import invalid_rows, sanitize_file, validate_public_trades

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

    def test_noncanonical_iso_dates_cannot_be_published(self):
        # Python date.fromisoformat accepts compact and ISO-week dates, but
        # both violate the public JSON calendar-date contract.
        for bad_date in ("20261020", "2026-W43-2", "2026-10-2"):
            with self.subTest(transaction_date=bad_date):
                payload = {"updated": "2026-10-28",
                           "trades": [record(), record(d=bad_date)]}
                self.assertEqual([i for i, _ in invalid_rows(payload)], [1])
            with self.subTest(snapshot_date=bad_date):
                with self.assertRaisesRegex(ValueError, "YYYY-MM-DD"):
                    invalid_rows({"updated": bad_date, "trades": [record()]})
            with self.subTest(filing_date=bad_date):
                payload = {"updated": "2026-10-28",
                           "trades": [record(), record(fd=bad_date)]}
                self.assertEqual([i for i, _ in invalid_rows(payload)], [1])

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


    def test_nonpublic_fields_cannot_reach_public_snapshot(self):
        # A collector change must not silently publish private metadata just
        # because its trade dates and official PDF URL look legitimate.
        valid = record()
        unsafe = record(email="private@example.test", internal_review="pending")
        data = {"updated": "2026-10-28", "trades": [valid, unsafe]}
        self.assertEqual([i for i, _ in invalid_rows(data)], [1])
        with tempfile.TemporaryDirectory() as td:
            path = pathlib.Path(td) / "trades-recent.json"
            path.write_text(json.dumps(data))
            self.assertEqual(sanitize_file(path), (1, 1))
            public = json.loads(path.read_text())
            self.assertEqual(public["trades"], [valid])
            self.assertNotIn("private@example.test", path.read_text())
            self.assertEqual(invalid_rows(public), [])

    def test_unexpected_top_level_fields_fail_closed(self):
        valid = {"updated": "2026-10-28", "trades": [record()]}
        for extra in ({"api_key": "secret"}, {"note": {"internal": "secret"}}):
            with self.subTest(extra=extra):
                data = {**valid, **extra}
                with self.assertRaisesRegex(ValueError, "Non-public|note must be text"):
                    invalid_rows(data)
                with tempfile.TemporaryDirectory() as td:
                    path = pathlib.Path(td) / "trades-recent.json"
                    original = json.dumps(data)
                    path.write_text(original)
                    with self.assertRaises(ValueError):
                        sanitize_file(path)
                    self.assertEqual(path.read_text(), original)


    def test_nested_or_markup_fields_are_quarantined(self):
        # Allowed keys are not enough: values must not hide private objects
        # or HTML that could be injected into a public map card.
        unsafe = [
            record(who={"private_email": "secret@example.test"}),
            record(tk=["ABC"]),
            record(ty="<img src=x onerror=alert(1)>"),
            record(amt={"internal": "review"}),
            record(who="A\nB"),
            record(tk="A" * 33),
            record(who=""),
            record(tk=None),
        ]
        payload = {"updated": "2026-10-28", "trades": [record()] + unsafe}
        self.assertEqual([i for i, _ in invalid_rows(payload)],
                         list(range(1, len(unsafe) + 1)))
        with tempfile.TemporaryDirectory() as td:
            path = pathlib.Path(td) / "trades-recent.json"
            path.write_text(json.dumps(payload))
            self.assertEqual(sanitize_file(path), (1, len(unsafe)))
            self.assertEqual(json.loads(path.read_text())["trades"], [record()])
            self.assertNotIn("secret@example.test", path.read_text())

    def test_official_pdf_archive_year_matches_filing_year(self):
        mismatched = record(doc=PDF.replace("/2026/", "/2025/"))
        errors = invalid_rows({"updated": "2026-10-28", "trades": [record(), mismatched]})
        self.assertEqual([i for i, _ in errors], [1])
        self.assertIn("archive year", errors[0][1])

    def test_note_cannot_embed_markup_or_nested_metadata(self):
        for note in ({"private": "secret"}, "<script>alert(1)</script>", "bad\x00text"):
            with self.subTest(note=note), self.assertRaises(ValueError):
                invalid_rows({"updated": "2026-10-28", "note": note, "trades": [record()]})



    def test_public_trade_summary_rejects_nested_and_markup_values(self):
        # The old artifact check only compared key names; these payloads
        # would have passed despite exposing private data under allowed keys.
        valid = {"updated": "2026-10-28", "source": "Official filing",
                 "note": "Delayed public disclosure",
                 "trades": [{"id": "A000001", "who": "Example Member",
                             "tk": "ABC", "r": 1.5, "rspy": -0.4}]}
        validate_public_trades(valid)
        bad_rows = [
            {"who": {"private_email": "secret@example.test"}},
            {"asset": ["private", "metadata"]},
            {"who": "<img src=x onerror=alert(1)>"},
            {"tk": "ABC\nprivate"},
            {"r": float("nan")},
            {"rspy": float("inf")},
            {"party": True},
        ]
        for bad in bad_rows:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                payload = {**valid, "trades": [{**valid["trades"][0], **bad}]}
                validate_public_trades(payload)

    def test_public_trade_summary_rejects_unsafe_structure(self):
        valid_row = {"who": "Example Member", "tk": "ABC"}
        for payload in (
            [],
            {"updated": "2026-10-28", "trades": []},
            {"updated": "2026-10-28", "trades": [None]},
            {"updated": "2026-10-28", "trades": [valid_row], "private": "secret"},
            {"updated": {"private": "secret"}, "trades": [valid_row]},
            {"updated": "2026-10-28", "note": "<script>x</script>", "trades": [valid_row]},
        ):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                validate_public_trades(payload)


if __name__ == "__main__":
    unittest.main()
