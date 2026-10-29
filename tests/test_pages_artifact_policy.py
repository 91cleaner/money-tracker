"""Regression tests for the fail-closed GitHub Pages artifact path policy."""
import importlib.util
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit-pages-artifact-policy.py"
spec = importlib.util.spec_from_file_location("pages_artifact_policy", SCRIPT)
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class PagesArtifactPolicyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / ".public-pages"
        self.root.mkdir()

    def add(self, name):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("fixture", encoding="utf-8")
        return path

    def test_valid_public_site_assets_are_allowed(self):
        for name in (
            ".nojekyll", "index.html", "sw.js", "manifest.webmanifest",
            "world-intelligence/index.html", "assets/mt-command-ui.js",
            "data/search/se/core.json", "data/national/countries-110m.geojson",
            "data/us/house-ptr-public.json",
        ):
            self.add(name)
        self.assertEqual(policy.violations(self.root), [])

    def test_private_research_datasets_are_blocked(self):
        for name in policy.PRIVATE_DATA_FILES:
            with self.subTest(name=name):
                self.add(name)
                self.assertTrue(policy.violations(self.root), name)
                (self.root / name).unlink()

    def test_builder_excludes_review_queues_but_keeps_public_assets(self):
        """The builder and auditor must agree on review-only data paths."""
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "scripts").mkdir()
            shutil.copy2(
                SCRIPT.parent / "prepare-public-pages.py",
                root / "scripts" / "prepare-public-pages.py",
            )
            shutil.copy2(SCRIPT, root / "scripts" / SCRIPT.name)
            required = (
                "index.html", "usa-command.html", "national.html",
                "assets/mt-command-ui.js", "data/national/countries-110m.geojson",
                "search.html", "assets/se.js", "data/search/se/core.json",
            )
            for name in required:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("fixture", encoding="utf-8")
            for name in policy.PRIVATE_DATA_FILES:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("private test fixture", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(root / "scripts" / "prepare-public-pages.py")],
                cwd=root, capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            artifact = root / ".public-pages"
            for name in policy.PRIVATE_DATA_FILES:
                with self.subTest(name=name):
                    self.assertFalse((artifact / name).exists(), name)
            for name in required:
                self.assertTrue((artifact / name).is_file(), name)
            self.assertEqual(policy.violations(artifact), [])

            # A future unreviewed JSON must stop the *real builder*,
            # even if the file is not in the exact-name denylist.
            unreviewed = root / "data/us/committee-review.json"
            unreviewed.parent.mkdir(parents=True, exist_ok=True)
            unreviewed.write_text("unverified fixture", encoding="utf-8")
            rejected = subprocess.run(
                [sys.executable, str(root / "scripts" / "prepare-public-pages.py")],
                cwd=root, capture_output=True, text=True, check=False,
            )
            self.assertNotEqual(rejected.returncode, 0)
            self.assertIn("Pages privacy audit failed", rejected.stderr)

            # A missing auditor is not a reason to silently publish.
            unreviewed.unlink()
            (root / "scripts" / SCRIPT.name).unlink()
            missing_auditor = subprocess.run(
                [sys.executable, str(root / "scripts" / "prepare-public-pages.py")],
                cwd=root, capture_output=True, text=True, check=False,
            )
            self.assertNotEqual(missing_auditor.returncode, 0)
            self.assertIn("Missing Pages privacy auditor", missing_auditor.stderr)

    def test_new_review_only_json_is_blocked_without_an_exact_denylist_entry(self):
        for name in ("data/us/committee-review.json",
                     "data/us/filing-candidates.json",
                     "data/other/secret-draft.json"):
            with self.subTest(name=name):
                self.add(name)
                self.assertTrue(
                    any("review-only dataset" in error for error in policy.violations(self.root)),
                    name,
                )
                (self.root / name).unlink()

    def test_nested_review_and_credential_paths_are_blocked(self):
        # A safe-looking filename must not bypass review-only directory checks.
        for name in (
            "data/us/research/records.json",
            "data/us/reviews/clean.json",
            "data/us/tokens/active.json",
            "data/us/oauth/session.json",
            "data/us/backup/latest.json",
            "data/us/api-keys.json",
            "data/us/passwords.json",
        ):
            with self.subTest(name=name):
                self.add(name)
                self.assertTrue(
                    any("review-only dataset" in issue for issue in policy.violations(self.root)),
                    name,
                )
                (self.root / name).unlink()

    def test_sensitive_token_boundaries_do_not_block_unrelated_names(self):
        # Whole tokens, not substrings, so public records remain usable.
        for name in (
            "data/us/backupplans.json",
            "data/us/sessionize-stats.json",
            "data/us/researcher-list.json",
        ):
            self.add(name)
        self.assertEqual(policy.violations(self.root), [])

    def test_hidden_and_internal_paths_are_blocked(self):
        for name in ("data/.env", "assets/.hidden.js", "data/internal/cache.json",
                     "data/secrets/keys.json", ".github/workflows/ci.yml"):
            with self.subTest(name=name):
                self.add(name)
                self.assertTrue(policy.violations(self.root), name)
                (self.root / name).unlink()

    def test_source_config_and_unsafe_extensions_are_blocked(self):
        for name in ("wrangler.toml", "assets/package.json",
                     "assets/config.pem", "data/dump.sqlite",
                     "worker/private-api.js"):
            with self.subTest(name=name):
                self.add(name)
                self.assertTrue(policy.violations(self.root), name)
                (self.root / name).unlink()

    def test_symlinks_are_blocked_even_with_public_extensions(self):
        target = self.add("index.html")
        link = self.root / "assets" / "copied.js"
        link.parent.mkdir()
        try:
            link.symlink_to(target)
        except (OSError, NotImplementedError):
            self.skipTest("symlinks not supported on this runner")
        self.assertTrue(any("symlink" in issue for issue in policy.violations(self.root)))

    def test_missing_artifact_is_not_a_success(self):
        self.assertTrue(policy.violations(self.root / "missing"))


if __name__ == "__main__":
    unittest.main()
