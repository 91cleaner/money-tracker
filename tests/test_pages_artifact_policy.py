"""Regression tests for the fail-closed GitHub Pages artifact path policy."""
import importlib.util
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
