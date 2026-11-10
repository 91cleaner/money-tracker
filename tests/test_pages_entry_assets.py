"""Regression tests for static Pages linked-asset audit."""
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "check-pages-entry-assets.py"
spec = importlib.util.spec_from_file_location("pages_entry_assets", SCRIPT)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class PagesEntryAssetTests(unittest.TestCase):
    def test_local_assets_with_cache_queries_and_parent_paths(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "world-intelligence").mkdir()
            (root / "assets").mkdir()
            (root / "assets" / "app.js").write_text("// ok")
            (root / "assets" / "site.css").write_text("/* ok */")
            (root / "assets" / "icon.svg").write_text("<svg/>")
            (root / "world-intelligence" / "index.html").write_text(
                '<script src="../assets/app.js?v=2"></script>'
                '<link rel="stylesheet" href="/money-tracker/assets/site.css">'
                '<img src="../assets/icon.svg">'
                '<script src="https://cdn.example.com/lib.js"></script>'
                '<img src="data:image/svg+xml,%3Csvg%3E">'
            )
            self.assertEqual(audit.find_missing(root, ["world-intelligence/index.html"]), [])

    def test_missing_asset_and_entry_page_fail(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "index.html").write_text('<script src="assets/missing.js?v=3"></script>')
            errors = audit.find_missing(root, ["index.html", "member.html"])
            self.assertEqual(len(errors), 2)
            self.assertTrue(any("missing linked asset" in x for x in errors))
            self.assertTrue(any("missing entry page" in x for x in errors))

    def test_escape_outside_artifact_is_rejected(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp) / "public"
            root.mkdir()
            (root / "index.html").write_text('<script src="../../secret.js"></script>')
            self.assertIn("escapes public artifact", audit.find_missing(root, ["index.html"])[0])


if __name__ == "__main__":
    unittest.main()
