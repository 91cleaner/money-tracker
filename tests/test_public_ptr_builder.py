"""Regression checks for the public House PTR summary builder.

A broken input ledger must not silently become a published zero-trade file.
"""
import importlib.util
import json
import subprocess
import sys
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
            self.assertEqual(published["source"], builder.PUBLIC_SOURCE)

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

    def test_publish_failure_keeps_previous_snapshot_and_cleans_temp_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = self._setup(root, {
                "updated": "2026-11-04",
                "trades": [{"id": "M1", "d": "2026-11-01"}],
            })
            target.parent.mkdir(parents=True)
            previous = '{"trades":[{"who":"last known good"}]}'
            target.write_text(previous, encoding="utf-8")
            with patch.object(builder, "ROOT", root):
                with patch.object(builder.os, "replace", side_effect=OSError("disk failure")):
                    with self.assertRaisesRegex(OSError, "disk failure"):
                        builder.build(target)
            self.assertEqual(target.read_text(encoding="utf-8"), previous)
            self.assertEqual(list(target.parent.glob(".trades_public.json.*.tmp")), [])

    def test_successful_publish_replaces_previous_snapshot_atomically(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = self._setup(root, {
                "updated": "2026-11-04",
                "trades": [{"id": "M1", "d": "2026-11-01"}],
            })
            target.parent.mkdir(parents=True)
            target.write_text('{"trades":[]}', encoding="utf-8")
            with patch.object(builder, "ROOT", root):
                self.assertEqual(builder.build(target), 1)
            self.assertEqual(len(json.loads(target.read_text(encoding="utf-8"))["trades"]), 1)
            self.assertEqual(list(target.parent.glob(".trades_public.json.*.tmp")), [])

    def test_explicit_empty_list_is_not_mistaken_for_broken_schema(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = self._setup(root, {"updated": "2026-11-04", "trades": []})
            with patch.object(builder, "ROOT", root):
                self.assertEqual(builder.build(target), 0)
            self.assertEqual(json.loads(target.read_text(encoding="utf-8"))["trades"], [])


    def test_nested_or_nonfinite_values_cannot_overwrite_public_snapshot(self):
        for invalid_field in (
            {"asset": {"private_notes": "do not publish"}},
            {"who": ["private", "data"]},
            {"r": float("nan")},
            {"rspy": float("inf")},
            {"verification": {"reviewer": "private"}},
        ):
            with self.subTest(invalid_field=invalid_field):
                with tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    target = self._setup(root, {
                        "trades": [{"id": "M1", "d": "2026-10-10", **invalid_field}],
                    })
                    target.parent.mkdir(parents=True)
                    previous = '{"trades":[{"who":"last good"}]}'
                    target.write_text(previous, encoding="utf-8")
                    with patch.object(builder, "ROOT", root):
                        with self.assertRaisesRegex(ValueError, "Invalid public trade field"):
                            builder.build(target)
                    self.assertEqual(target.read_text(encoding="utf-8"), previous)

    def test_unapproved_review_text_is_not_published(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = self._setup(root, {
                "trades": [{
                    "id": "M1", "d": "2026-10-10",
                    "verification": "Reviewed by private analyst@example.com",
                }],
            })
            with patch.object(builder, "ROOT", root):
                self.assertEqual(builder.build(target), 1)
            row = json.loads(target.read_text(encoding="utf-8"))["trades"][0]
            self.assertEqual(row["verification"], "unknown")
            self.assertNotIn("analyst@example.com", target.read_text(encoding="utf-8"))

    def test_pages_artifact_gate_accepts_verification_and_rejects_private_fields(self):
        """The generated public PTR snapshot must pass the real Pages privacy gate."""
        checker = SCRIPT.parent / "check-pages-artifact.py"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._setup(root, {
                "updated": "2026-11-04",
                "source": "House Clerk PTR",
                "trades": [{
                    "id": "M1", "who": "Example Member",
                    "verification": "machine_parsed_requires_review",
                }],
            })
            artifact = root / "public"
            published = artifact / "data/us/trades_public.json"
            published.parent.mkdir(parents=True)
            with patch.object(builder, "ROOT", root):
                builder.build(published)
            for name in (
                "index.html", "search.html", "national.html", "usa-command.html",
                "assets/se.js", "assets/mt-command-ui.js",
                "data/search/se/core.json", "data/national/countries-110m.geojson",
            ):
                file = artifact / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text("fixture", encoding="utf-8")

            def check():
                return subprocess.run(
                    [sys.executable, str(checker), str(artifact)],
                    capture_output=True, text=True, check=False,
                )

            accepted = check()
            self.assertEqual(accepted.returncode, 0, accepted.stdout + accepted.stderr)
            snapshot = json.loads(published.read_text(encoding="utf-8"))
            self.assertEqual(snapshot["trades"][0]["verification"],
                             "machine_parsed_requires_review")
            snapshot["trades"][0]["private_notes"] = "must not be published"
            published.write_text(json.dumps(snapshot), encoding="utf-8")
            rejected = check()
            self.assertNotEqual(rejected.returncode, 0)
            self.assertIn("non-public fields", rejected.stdout + rejected.stderr)
            snapshot["trades"][0].pop("private_notes")
            snapshot["trades"][0]["verification"] = {"private_notes": "nested secret"}
            published.write_text(json.dumps(snapshot), encoding="utf-8")
            nested = check()
            self.assertNotEqual(nested.returncode, 0)
            self.assertIn("rows must contain only finite scalar values", nested.stdout + nested.stderr)

            snapshot["trades"][0]["verification"] = "private analyst@example.com"
            published.write_text(json.dumps(snapshot), encoding="utf-8")
            unapproved = check()
            self.assertNotEqual(unapproved.returncode, 0)
            self.assertIn("approved public status", unapproved.stdout + unapproved.stderr)

            snapshot["trades"][0]["verification"] = "unknown"
            snapshot["trades"][0]["asset"] = {"private_notes": "nested leak"}
            published.write_text(json.dumps(snapshot), encoding="utf-8")
            nested_asset = check()
            self.assertNotEqual(nested_asset.returncode, 0)
            self.assertIn("rows must contain only finite scalar values", nested_asset.stdout + nested_asset.stderr)

            snapshot["trades"][0].pop("asset")
            snapshot["trades"][0]["r"] = float("nan")
            published.write_text(json.dumps(snapshot), encoding="utf-8")
            nonfinite = check()
            self.assertNotEqual(nonfinite.returncode, 0)
            self.assertIn("Non-standard JSON numeric constant", nonfinite.stdout + nonfinite.stderr)

            snapshot["trades"] = None
            published.write_text(json.dumps(snapshot), encoding="utf-8")
            malformed = check()
            self.assertNotEqual(malformed.returncode, 0)
            self.assertIn("trades array of objects", malformed.stdout + malformed.stderr)


    def test_public_metadata_never_copies_private_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = self._setup(root, {
                "updated": "2026-11-05T03:58:33+09:00",
                "source": {"private_notes": "DO_NOT_PUBLISH"},
                "trades": [],
            })
            with patch.object(builder, "ROOT", root):
                self.assertEqual(builder.build(target), 0)
            published = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(published["source"], builder.PUBLIC_SOURCE)
            self.assertEqual(published["note"], builder.PUBLIC_NOTE)
            self.assertNotIn("DO_NOT_PUBLISH", target.read_text(encoding="utf-8"))
            self.assertEqual(published["updated"], "2026-11-05T03:58:33+09:00")

    def test_unreviewed_long_source_text_is_not_published(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = self._setup(root, {
                "updated": "2026-11-05",
                "source": "internal analyst@example.com " * 100,
                "trades": [],
            })
            with patch.object(builder, "ROOT", root):
                self.assertEqual(builder.build(target), 0)
            published = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(published["source"], builder.PUBLIC_SOURCE)
            self.assertNotIn("analyst@example.com", target.read_text(encoding="utf-8"))

    def test_invalid_updated_metadata_cannot_replace_previous_snapshot(self):
        for invalid in ({"private_notes": "secret"}, ["secret"], "bad date",
                        "2026-02-30", "2026-11-05" + "x" * 100):
            with self.subTest(invalid=invalid):
                with tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    target = self._setup(root, {
                        "updated": invalid, "source": "private@example.com", "trades": [],
                    })
                    target.parent.mkdir(parents=True)
                    sentinel = '{"trades":[{"who":"last good"}]}'
                    target.write_text(sentinel, encoding="utf-8")
                    with patch.object(builder, "ROOT", root):
                        with self.assertRaisesRegex(ValueError, "Invalid updated metadata"):
                            builder.build(target)
                    self.assertEqual(target.read_text(encoding="utf-8"), sentinel)

    def test_artifact_gate_rejects_top_level_metadata_tampering(self):
        checker = SCRIPT.parent / "check-pages-artifact.py"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = self._setup(root, {"updated": "2026-11-05", "trades": []})
            artifact = root / "public"
            published = artifact / "data/us/trades_public.json"
            published.parent.mkdir(parents=True)
            with patch.object(builder, "ROOT", root):
                builder.build(published)
            for name in (
                "index.html", "search.html", "national.html", "usa-command.html",
                "assets/se.js", "assets/mt-command-ui.js",
                "data/search/se/core.json", "data/national/countries-110m.geojson",
            ):
                path = artifact / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("fixture", encoding="utf-8")

            def check():
                return subprocess.run(
                    [sys.executable, str(checker), str(artifact)],
                    capture_output=True, text=True, check=False,
                )
            self.assertEqual(check().returncode, 0)
            original = json.loads(published.read_text(encoding="utf-8"))
            for field, value in (
                ("source", {"private_notes": "DO_NOT_PUBLISH"}),
                ("source", "private analyst@example.com"),
                ("note", ["private memo"]),
                ("updated", {"private_notes": "DO_NOT_PUBLISH"}),
                ("updated", "2026-02-30"),
            ):
                with self.subTest(field=field, value=value):
                    mutated = dict(original)
                    mutated[field] = value
                    published.write_text(json.dumps(mutated), encoding="utf-8")
                    self.assertNotEqual(check().returncode, 0)

if __name__ == "__main__":
    unittest.main()
