"""Offline regression tests for strict Pages publication-step detection."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).with_name("check-pages-publish-step.py")
spec = importlib.util.spec_from_file_location("pages_publish_step", SCRIPT)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def jobs_payload(conclusion="success"):
    return {"jobs": [{"name": "deploy", "conclusion": "failure", "steps": [
        {"name": "Run actions/upload-pages-artifact@v3", "conclusion": "success"},
        {"name": audit.DEPLOY_STEP, "conclusion": conclusion},
        {"name": "Verify published entry and US command", "conclusion": "failure"},
    ]}]}


class PagesPublishStepTests(unittest.TestCase):
    def test_publish_success_even_when_later_smoke_fails(self):
        self.assertTrue(audit.was_pages_published(jobs_payload()))

    def test_publish_failure_does_not_trigger_audit(self):
        self.assertFalse(audit.was_pages_published(jobs_payload("failure")))

    def test_publish_skipped_does_not_trigger_audit(self):
        self.assertFalse(audit.was_pages_published(jobs_payload("skipped")))

    def test_missing_deploy_job_is_error_not_false(self):
        with self.assertRaisesRegex(ValueError, "exactly one deploy job"):
            audit.was_pages_published({"jobs": [{"name": "test", "steps": []}]})

    def test_duplicate_deploy_jobs_are_error(self):
        payload = jobs_payload()
        payload["jobs"].append(payload["jobs"][0].copy())
        with self.assertRaisesRegex(ValueError, "exactly one deploy job"):
            audit.was_pages_published(payload)

    def test_missing_or_renamed_step_is_error(self):
        payload = jobs_payload()
        payload["jobs"][0]["steps"][1]["name"] = "Deploy Pages renamed"
        with self.assertRaisesRegex(ValueError, "exactly one"):
            audit.was_pages_published(payload)

    def test_duplicate_publish_steps_are_error(self):
        payload = jobs_payload()
        payload["jobs"][0]["steps"].append({"name": audit.DEPLOY_STEP, "conclusion": "success"})
        with self.assertRaisesRegex(ValueError, "exactly one"):
            audit.was_pages_published(payload)

    def test_missing_jobs_array_is_error(self):
        with self.assertRaisesRegex(ValueError, "jobs array"):
            audit.was_pages_published({})

    def test_missing_steps_array_is_error(self):
        with self.assertRaisesRegex(ValueError, "steps array"):
            audit.was_pages_published({"jobs": [{"name": "deploy"}]})

    def test_incomplete_step_is_error(self):
        with self.assertRaisesRegex(ValueError, "incomplete"):
            audit.was_pages_published(jobs_payload(None))


if __name__ == "__main__":
    unittest.main()
