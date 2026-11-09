"""Release regression: a green Pages deploy must not skip the full test suite.

This guards the deploy workflow's own pre-publication checks; it does not
claim that separate map/Chromium workflows or live iPhone QA are covered.
"""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
DEPLOY = ROOT / ".github" / "workflows" / "deploy-pages.yml"


class PagesReleaseGateTests(unittest.TestCase):
    def test_full_suite_runs_before_upload_and_publish(self):
        workflow = DEPLOY.read_text(encoding="utf-8")
        suite = workflow.index("python3 -m unittest discover -s tests")
        upload = workflow.index("uses: actions/upload-pages-artifact@")
        publish = workflow.index("uses: actions/deploy-pages@")
        self.assertLess(suite, upload, "Full suite must gate artifact upload")
        self.assertLess(upload, publish, "Publish must follow checked artifact")

    def test_security_syntax_and_private_api_run_before_upload(self):
        workflow = DEPLOY.read_text(encoding="utf-8")
        upload = workflow.index("uses: actions/upload-pages-artifact@")
        for command in (
            "node --check worker/private-api.js",
            "node --check assets/mt-engagement.js",
            "node --test worker/private-api.test.mjs",
        ):
            with self.subTest(command=command):
                self.assertIn(command, workflow[:upload])


    def test_question_choice_map_contracts_are_a_fail_closed_release_gate(self):
        workflow = DEPLOY.read_text(encoding="utf-8")
        gate = workflow.split(
            "      - name: Gate publication on full security and data regression suite", 1
        )[1].split("      - name: Build public-only artifact", 1)[0]
        for suite in (
            "tests/usa-map-smoke.test.cjs",
            "tests/mt-command.test.cjs",
            "tests/mt-research.test.cjs",
            "tests/world-command-smoke.test.mjs",
        ):
            with self.subTest(suite=suite):
                self.assertIn(suite, gate, "Critical map/search smoke must gate Pages")
        self.assertIn("node --test ", gate)
        self.assertNotIn("continue-on-error", gate, "A red map smoke must block release")
        self.assertNotIn("|| true", gate, "A red map smoke must block release")


if __name__ == "__main__":
    unittest.main()
