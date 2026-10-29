"""Regression tests for read-only live Pages exposure checks."""
import importlib.util
from pathlib import Path
from urllib.error import HTTPError
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "check_live_pages_exposure.py"
spec = importlib.util.spec_from_file_location("live_pages_audit", SCRIPT)
audit_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_mod)


class FakeResponse:
    def __init__(self, status, url):
        self.status = status
        self.url = url

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def geturl(self):
        return self.url


class LivePagesExposureTests(unittest.TestCase):
    BASE = "https://example.github.io/money-tracker/"

    def test_only_missing_blocked_paths_pass(self):
        result, exposed, unknown = audit_mod.audit(
            self.BASE, probe=lambda base, path: 200 if path == "index.html" else 404)
        self.assertEqual(len(result), len(audit_mod.BLOCKED))
        self.assertEqual((exposed, unknown), ([], []))

    def test_exposed_candidate_json_fails(self):
        _, exposed, _ = audit_mod.audit(self.BASE, probe=lambda base, path:
            200 if path in ("index.html", "data/us/house-ptr-candidates.json") else 404)
        self.assertEqual(exposed, ["data/us/house-ptr-candidates.json"])

    def test_inconclusive_status_not_treated_as_safe(self):
        _, _, unknown = audit_mod.audit(self.BASE, probe=lambda base, path:
            200 if path == "index.html" else 403)
        self.assertEqual(len(unknown), len(audit_mod.BLOCKED))

    def test_unavailable_site_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "entry point unavailable"):
            audit_mod.audit(self.BASE, probe=lambda base, path: 404)

    def test_get_detects_file_even_if_head_would_report_404(self):
        # HEAD 404 is not proof a file is inaccessible via GET.
        methods = []
        def opener(req, timeout):
            methods.append(req.get_method())
            if req.get_method() == "HEAD":
                raise HTTPError(req.full_url, 404, "missing on HEAD", {}, None)
            self.assertEqual(req.headers.get("Range"), "bytes=0-0")
            return FakeResponse(206, req.full_url)
        self.assertEqual(audit_mod.status_for(self.BASE, "x.json", opener), 206)
        self.assertEqual(methods, ["GET"])

    def test_get_404_is_a_missing_file(self):
        def opener(req, timeout):
            self.assertEqual(req.get_method(), "GET")
            raise HTTPError(req.full_url, 404, "not found", {}, None)
        self.assertEqual(audit_mod.status_for(self.BASE, "x.json", opener), 404)

    def test_exposed_review_queue_is_detected(self):
        _, exposed, _ = audit_mod.audit(self.BASE, probe=lambda base, path:
            206 if path == "data/us-ptr-research-queue.json"
            else 200 if path == "index.html" else 404)
        self.assertEqual(exposed, ["data/us-ptr-research-queue.json"])

    def test_review_only_ptr_artifacts_are_in_live_blocklist(self):
        self.assertTrue({
            "data/us-ptr-research-queue.json",
            "data/us-ptr-extraction-status.json",
        }.issubset(set(audit_mod.BLOCKED)))

    def test_external_redirect_is_not_a_pass(self):
        def opener(req, timeout):
            return FakeResponse(200, "https://other.example.net/redirect")
        with self.assertRaisesRegex(RuntimeError, "unexpected redirect"):
            audit_mod.status_for(self.BASE, "x.json", opener)

    def test_legacy_source_canaries_are_blocked(self):
        # These files exist in the repo but should never be shipped by the
        # allowlisted Pages artifact. A legacy branch publisher may serve them.
        expected = {"server/worker.mjs", "wrangler.toml", "HANDOFF.md", "docs/AI-ROLES.md"}
        self.assertTrue(expected.issubset(set(audit_mod.BLOCKED)))

    def test_public_trade_disclosures_not_blocked(self):
        self.assertNotIn("data/us/trades.json", audit_mod.BLOCKED)


if __name__ == "__main__":
    unittest.main()
