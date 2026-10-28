"""Regression tests for the Pages source configuration safety gate."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_pages_source import check_pages_source


class PagesSourceGuardTests(unittest.TestCase):
    def test_actions_source_passes(self):
        self.assertIn("PASS", check_pages_source({"build_type": "workflow"}))

    def test_legacy_branch_source_fails(self):
        with self.assertRaisesRegex(ValueError, "Legacy branch publishing"):
            check_pages_source({"build_type": "legacy", "source": {"branch": "main"}})

    def test_missing_build_type_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "UNSAFE"):
            check_pages_source({"source": {"branch": "main"}})

    def test_unexpected_response_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "JSON object"):
            check_pages_source([])


if __name__ == "__main__":
    unittest.main()
