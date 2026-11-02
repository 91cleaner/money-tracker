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
            body = ({"collectors": {}} if "collection-status" in path else
                    {"trades": [{"id": "fixture"}]} if path.endswith("trades_public.json") else
                    {"trades": []})
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

    def test_empty_historical_public_summary_fails_closed(self):
        path = audit.PUBLIC_JSON_PATHS[0]
        (self.root / path).write_bytes(b'{"trades":[]}')
        with self.assertRaisesRegex(ValueError, "empty public trade summary"):
            self.check()

    def test_empty_deployed_public_summary_fails_closed(self):
        path = audit.PUBLIC_JSON_PATHS[0]
        self.docs[path] = b'{"trades":[]}'
        with self.assertRaisesRegex(RuntimeError, "empty public trade summary"):
            self.check()

    def test_empty_recent_window_is_allowed(self):
        # No recent filings is not the same as an empty historical ledger.
        path = audit.PUBLIC_JSON_PATHS[1]
        self.assertEqual(self.docs[path], b'{"trades": []}')
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

    def test_duplicate_top_level_keys_in_local_json_fail_closed(self):
        path = audit.PUBLIC_JSON_PATHS[0]
        (self.root / path).write_bytes(b'{"trades":[],"trades":[{"id":"shadow"}]}')
        with self.assertRaisesRegex(ValueError, "invalid JSON"):
            self.check()

    def test_duplicate_nested_collector_keys_in_local_json_fail_closed(self):
        path = audit.PUBLIC_JSON_PATHS[2]
        (self.root / path).write_bytes(
            b'{"collectors":{"house":{"count":0,"count":42}}}'
        )
        with self.assertRaisesRegex(ValueError, "invalid JSON"):
            self.check()

    def test_duplicate_keys_in_remote_json_fail_closed(self):
        path = audit.PUBLIC_JSON_PATHS[0]
        self.docs[path] = b'{"trades":[],"trades":[{"id":"shadow"}]}'
        with self.assertRaisesRegex(RuntimeError, "invalid JSON"):
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

    def test_browser_unsafe_integer_local_json_fails_closed(self):
        # Python accepts 2**53 exactly, but JSON.parse rounds integers beyond
        # Number.MAX_SAFE_INTEGER and can misidentify trades or counts.
        path = audit.PUBLIC_JSON_PATHS[0]
        for number in ("9007199254740992", "-9007199254740992"):
            with self.subTest(number=number):
                (self.root / path).write_bytes(
                    ('{"trades":[{"id":' + number + '}]}').encode("ascii")
                )
                with self.assertRaisesRegex(ValueError, "invalid JSON"):
                    self.check()

    def test_browser_unsafe_integer_remote_json_fails_closed(self):
        path = audit.PUBLIC_JSON_PATHS[2]
        self.docs[path] = b'{"collectors":{"house":{"count":9007199254740992}}}'
        with self.assertRaisesRegex(RuntimeError, "invalid JSON"):
            self.check()

    def test_browser_unsafe_decimal_and_exponent_fail_closed(self):
        path = audit.PUBLIC_JSON_PATHS[0]
        for number in ("9007199254740993.0", "9007199254740991.25",
                       "1e16", "-1e16"):
            with self.subTest(number=number):
                content = ('{"trades":[{"id":' + number + '}]}').encode("ascii")
                (self.root / path).write_bytes(content)
                with self.assertRaisesRegex(ValueError, "invalid JSON"):
                    self.check()

    def test_fractional_part_rounded_to_integer_local_fails_closed(self):
        # These valid JSON decimals become exact integers after JS Number
        # conversion, silently losing the reported fractional component.
        path = audit.PUBLIC_JSON_PATHS[0]
        for number in ("9007199254740990.1", "-9007199254740990.1",
                       "9007199254740990.5", "1.0000000000000001",
                       "0.99999999999999999"):
            with self.subTest(number=number):
                (self.root / path).write_bytes(
                    ('{"trades":[{"r":' + number + '}]}').encode("ascii")
                )
                with self.assertRaisesRegex(ValueError, "invalid JSON"):
                    self.check()

    def test_fractional_part_rounded_to_integer_remote_fails_closed(self):
        path = audit.PUBLIC_JSON_PATHS[2]
        self.docs[path] = b'{"collectors":{"house":{"count":0,"errors":[],"ratio":9007199254740990.1}}}'
        with self.assertRaisesRegex(RuntimeError, "invalid JSON"):
            self.check()

    def test_browser_safe_decimal_boundary_still_passes(self):
        path = audit.PUBLIC_JSON_PATHS[0]
        content = b'{"trades":[{"id":9007199254740991.0}]}'
        (self.root / path).write_bytes(content)
        self.docs[path] = content
        self.assertTrue(self.check())

    def test_browser_safe_integer_boundary_still_passes(self):
        path = audit.PUBLIC_JSON_PATHS[0]
        for number in ("9007199254740991", "-9007199254740991"):
            with self.subTest(number=number):
                content = ('{"trades":[{"id":' + number + '}]}').encode("ascii")
                (self.root / path).write_bytes(content)
                self.docs[path] = content
                self.assertTrue(self.check())

    def test_bom_and_non_utf8_local_json_fail_closed(self):
        # json.loads(bytes) accepts these, but browser JSON parsers do not.
        path = audit.PUBLIC_JSON_PATHS[0]
        for content in (
            b'\xef\xbb\xbf{"trades":[]}',
            '{"trades":[]}'.encode("utf-16"),
            '{"trades":[]}'.encode("utf-32"),
        ):
            with self.subTest(content=content[:8]):
                (self.root / path).write_bytes(content)
                with self.assertRaisesRegex(ValueError, "invalid JSON"):
                    self.check()

    def test_bom_and_non_utf8_remote_json_fail_closed(self):
        path = audit.PUBLIC_JSON_PATHS[0]
        for content in (
            b'\xef\xbb\xbf{"trades":[]}',
            '{"trades":[]}'.encode("utf-16"),
            '{"trades":[]}'.encode("utf-32"),
        ):
            with self.subTest(content=content[:8]):
                self.docs[path] = content
                with self.assertRaisesRegex(RuntimeError, "invalid JSON"):
                    self.check()

    def test_valid_utf8_unicode_json_still_passes(self):
        path = audit.PUBLIC_JSON_PATHS[0]
        content = json.dumps({"trades": [{"who": "의원"}]}, ensure_ascii=False).encode("utf-8")
        (self.root / path).write_bytes(content)
        self.docs[path] = content
        self.assertTrue(self.check())

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

    def test_non_object_trade_rows_fail_closed(self):
        for path in audit.PUBLIC_JSON_PATHS[:2]:
            with self.subTest(path=path):
                (self.root / path).write_bytes(b'{"trades":[null]}')
                with self.assertRaisesRegex(ValueError, "trade 0 must be an object"):
                    self.check()
                (self.root / path).write_bytes(self.docs[path])

    def test_remote_non_object_trade_rows_fail_closed(self):
        path = audit.PUBLIC_JSON_PATHS[1]
        self.docs[path] = b'{"trades":[42]}'
        with self.assertRaisesRegex(RuntimeError, "trade 0 must be an object"):
            self.check()

    def test_invalid_collector_count_fails_closed(self):
        path = audit.PUBLIC_JSON_PATHS[2]
        for count in (True, -1, 1.5, "0", None):
            with self.subTest(count=count):
                (self.root / path).write_text(json.dumps({
                    "collectors": {"house": {"count": count, "errors": []}}
                }))
                with self.assertRaisesRegex(ValueError, "invalid count"):
                    self.check()

    def test_invalid_collector_errors_fail_closed(self):
        path = audit.PUBLIC_JSON_PATHS[2]
        for errors in (None, "failed", [7], {}):
            with self.subTest(errors=errors):
                (self.root / path).write_text(json.dumps({
                    "collectors": {"house": {"count": 0, "errors": errors}}
                }))
                with self.assertRaisesRegex(ValueError, "invalid errors list"):
                    self.check()

    def test_valid_collector_failures_are_preserved(self):
        path = audit.PUBLIC_JSON_PATHS[2]
        content = json.dumps({"collectors": {
            "taiwan_legislature": {"count": 0, "errors": ["members: fetch failed"]},
            "us_sec": {"count": 74, "errors": []},
        }}).encode()
        (self.root / path).write_bytes(content)
        self.docs[path] = content
        self.assertTrue(self.check())

    def test_plain_http_rejected(self):
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            audit.check_public_json("http://example.com", self.root)


if __name__ == "__main__":
    unittest.main()
