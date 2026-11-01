"""Offline regression tests for the Pages public JSON parity gate."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("check-pages-public-json.py")
spec = importlib.util.spec_from_file_location("pages_public_json", SCRIPT)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class FakeResponse:
    status = 200

    def __init__(self, body, status=200):
        self.data = io.BytesIO(body)
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.data.close()

    def read(self, n):
        return self.data.read(n)


class PublicJsonParityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.docs = {}
        for path in audit.PUBLIC_JSON_PATHS:
            body = {"collectors": {}} if "collection-status" in path else {"trades": []}
            content = json.dumps(body).encode()
            self.docs[path] = content
            target = self.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)

    def opener(self, request, timeout):
        path = request.full_url.split("/money-tracker/", 1)[1]
        return FakeResponse(self.docs[path])

    def check(self, opener=None, attempts=1):
        with patch("builtins.print"):
            return audit.check_public_json("https://example.github.io/money-tracker/", self.root, opener=opener or self.opener, sleeper=lambda _: None, attempts=attempts)

    def test_matching_json_passes(self):
        self.assertTrue(self.check())

    def test_json_mismatch_fails_even_when_html_would_match(self):
        path = audit.PUBLIC_JSON_PATHS[0]
        self.docs[path] = b'{"trades":[{"id":"changed"}]}'
        with self.assertRaisesRegex(RuntimeError, "SHA-256 mismatch"):
            self.check()

    def test_mismatch_retries_and_can_recover(self):
        calls = [0]
        def opener(request, timeout):
            path = request.full_url.split("/money-tracker/", 1)[1]
            if path == audit.PUBLIC_JSON_PATHS[0] and calls[0] == 0:
                calls[0] += 1
                return FakeResponse(b'{"trades":[{"id":"stale"}]}')
            return FakeResponse(self.docs[path])
        self.assertTrue(self.check(opener=opener, attempts=2))

    def test_missing_local_json_fails(self):
        (self.root / audit.PUBLIC_JSON_PATHS[1]).unlink()
        with self.assertRaises(FileNotFoundError):
            self.check()

    def test_remote_html_200_fails_closed(self):
        def opener(request, timeout):
            return FakeResponse(b"<html>not JSON</html>")
        with self.assertRaisesRegex(RuntimeError, "invalid JSON"):
            self.check(opener=opener)

    def test_remote_404_fails_closed(self):
        def opener(request, timeout):
            return FakeResponse(b"", status=404)
        with self.assertRaisesRegex(RuntimeError, "HTTP 404"):
            self.check(opener=opener)

    def test_invalid_local_schema_fails_closed(self):
        (self.root / audit.PUBLIC_JSON_PATHS[2]).write_text('{"collectors": []}')
        with self.assertRaisesRegex(ValueError, "missing collectors object"):
            self.check()

    def test_nonfinite_local_json_fails_closed(self):
        path = audit.PUBLIC_JSON_PATHS[0]
        for constant in (b"NaN", b"Infinity", b"-Infinity"):
            with self.subTest(constant=constant):
                (self.root / path).write_bytes(b'{"trades":[{"r":' + constant + b"}]}")
                with self.assertRaisesRegex(ValueError, "invalid JSON"):
                    self.check()

    def test_nonfinite_remote_json_fails_closed(self):
        path = audit.PUBLIC_JSON_PATHS[0]
        self.docs[path] = b'{"trades":[{"r":NaN}]}'
        with self.assertRaisesRegex(RuntimeError, "invalid JSON"):
            self.check()

    def test_overflowing_exponent_in_local_json_fails_closed(self):
        # 1e999 is valid JSON number syntax, but Python float becomes inf.
        path = audit.PUBLIC_JSON_PATHS[0]
        for value in (b"1e999", b"-1e999"):
            with self.subTest(value=value):
                (self.root / path).write_bytes(b'{"trades":[{"r":' + value + b"}]}")
                with self.assertRaisesRegex(ValueError, "invalid JSON"):
                    self.check()

    def test_overflowing_exponent_in_remote_json_fails_closed(self):
        path = audit.PUBLIC_JSON_PATHS[2]
        self.docs[path] = b'{"collectors":{"house":{"value":1e999}}}'
        with self.assertRaisesRegex(RuntimeError, "invalid JSON"):
            self.check()

    def test_regular_fractional_json_number_still_passes(self):
        path = audit.PUBLIC_JSON_PATHS[0]
        content = b'{"trades":[{"r":1.25}]}'
        (self.root / path).write_bytes(content)
        self.docs[path] = content
        self.assertTrue(self.check())

    def test_exact_response_url_passes(self):
        class URLResponse(FakeResponse):
            def __init__(self, body, url):
                super().__init__(body)
                self.url = url

            def geturl(self):
                return self.url

        def opener(request, timeout):
            path = request.full_url.split("/money-tracker/", 1)[1]
            return URLResponse(self.docs[path], request.full_url)

        self.assertTrue(self.check(opener=opener))

    def test_redirected_json_200_fails_closed(self):
        class RedirectedResponse(FakeResponse):
            def __init__(self, body, final_url):
                super().__init__(body)
                self.final_url = final_url

            def geturl(self):
                return self.final_url

        for final_url in (
            "https://elsewhere.example/data/us/trades_public.json",
            "https://example.github.io/money-tracker/data/us/other.json",
        ):
            with self.subTest(final_url=final_url):
                def opener(request, timeout):
                    path = request.full_url.split("/money-tracker/", 1)[1]
                    return RedirectedResponse(self.docs[path], final_url)

                with self.assertRaisesRegex(RuntimeError, "unexpected redirect target"):
                    self.check(opener=opener)

    def test_plain_http_rejected(self):
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            audit.check_public_json("http://example.com", self.root)


if __name__ == "__main__":
    unittest.main()
