"""Regression checks for the public House PTR summary builder.

A broken input ledger must not silently become a published zero-trade file.
"""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_public_trades.py"
spec = importlib.util.spec_from_file_location("build_public_trades", SCRIPT)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class PublicPtrBuilderTests(unittest.TestCase):
    def _setup(self, root, source, members=None):
        folder = root / "data" / "us"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "trades.json").write_text(json.dumps(source), encoding="utf-8")
        if members is not None:
            (folder / "members.json").write_text(
                json.dumps({"members": members}), encoding="utf-8")
        return root / "published" / "trades_public.json"

    def test_preserves_source_review_warning_and_excludes_private_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = self._setup(root, {
                "updated": "2026-11-04",
                "source": "House Clerk PTR",
                "trades": [{
                    "id": "M1", "who": "Example Member", "d": "2026-10-10",
                    "asset": "Example Inc", "tk": "EX", "ty": "P",
                    "amt": "$1,001-$15,000",
                    "doc": "https://disclosures-clerk.house.gov/example.pdf",
                    "verification": "machine_parsed_requires_review",
                    "private_notes": "do not publish",
                    "account_number": "secret",
                }],
            }, members=[{"id": "M1", "party": "I", "state": "CA"}])
            with patch.object(builder, "ROOT", root):
                self.assertEqual(builder.build(target), 1)
            published = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(published["trades"][0]["verification"],
                             "machine_parsed_requires_review")
            self.assertEqual(published["trades"][0]["party"], "I")
            self.assertEqual(published["trades"][0]["state"], "CA")
            self.assertNotIn("private_notes", published["trades"][0])
            self.assertNotIn("account_number", published["trades"][0])
            self.assertEqual(published["source"], "House Clerk PTR")

    def test_malformed_ledger_does_not_overwrite_last_good_public_snapshot(self):
        for invalid in ({}, {"trades": None}, {"trades": {}},
                        {"trades": "bad"}, {"trades": [None]},
                        {"trades": ["not a record"]}):
            with self.subTest(invalid=invalid):
                with tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    target = self._setup(root, invalid)
                    target.parent.mkdir(parents=True)
                    sentinel = '{"trades":[{"who":"previously published"}]}'
                    target.write_text(sentinel, encoding="utf-8")
                    with patch.object(builder, "ROOT", root):
                        with self.assertRaises(ValueError):
                            builder.build(target)
                    self.assertEqual(target.read_text(encoding="utf-8"), sentinel)

    def test_explicit_empty_list_is_not_mistaken_for_broken_schema(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = self._setup(root, {"updated": "2026-11-04", "trades": []})
            with patch.object(builder, "ROOT", root):
                self.assertEqual(builder.build(target), 0)
            self.assertEqual(json.loads(target.read_text(encoding="utf-8"))["trades"], [])


if __name__ == "__main__":
    unittest.main()
