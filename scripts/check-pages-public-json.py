#!/usr/bin/env python3
"""Fail closed if deployed public JSON differs from the release artifact.

This checks exact published bytes, not the accuracy of the underlying filings.
Run after the Pages deploy, using the same commit SHA that produced the artifact.
"""
import argparse
from decimal import Decimal
import hashlib
import json
import math
from pathlib import Path
import sys
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

PUBLIC_JSON_PATHS = (
    "data/us/trades_public.json",
    "data/us/trades-recent.json",
    "data/search/collection-status.json",
)
MAX_BYTES = 16 * 1024 * 1024
MAX_SAFE_JSON_INTEGER = (1 << 53) - 1  # Largest integer JavaScript can represent exactly.


def reject_nonfinite(value):
    raise ValueError(f"non-finite JSON constant: {value}")


def reject_overflowing_float(value):
    # Valid JSON exponent syntax can overflow Python float to Infinity.
    # parse_constant only catches literal NaN/Infinity, not 1e999.
    number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"non-finite JSON number: {value}")
    # Exponent and decimal forms (e.g. 9007199254740993.0 or 1e16)
    # also lose integer precision in JavaScript. Compare the original token,
    # not its already-rounded float representation.
    if abs(Decimal(value)) > MAX_SAFE_JSON_INTEGER:
        raise ValueError(f"JSON number exceeds browser-safe range: {value}")
    return number


def reject_unsafe_integer(value):
    # Python preserves arbitrary-size JSON integers, but browser JSON.parse
    # rounds integers outside IEEE-754 safe range. A parity match alone cannot
    # prevent a silently corrupted trade ID or collector count in the UI.
    number = int(value)
    if abs(number) > MAX_SAFE_JSON_INTEGER:
        raise ValueError(f"JSON integer exceeds browser-safe range: {value}")
    return number


def reject_duplicate_keys(pairs):
    # Python json.loads silently keeps the last duplicate key. Reject ambiguous
    # trade and collector snapshots instead of trusting a last-wins value.
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def validate_json(path, body):
    if len(body) > MAX_BYTES:
        raise ValueError(f"{path}: JSON exceeds {MAX_BYTES} bytes")
    try:
        # Python json.loads(bytes) auto-detects UTF-16/32 and accepts UTF-8 BOM,
        # but browser JSON.parse / response.json() expects UTF-8 JSON text.
        # Decode strictly first so byte-identical, browser-unreadable files fail.
        data = json.loads(body.decode("utf-8"), parse_constant=reject_nonfinite,
                          parse_float=reject_overflowing_float,
                          parse_int=reject_unsafe_integer,
                          object_pairs_hook=reject_duplicate_keys)
    except (UnicodeDecodeError, ValueError) as exc:
        raise ValueError(f"{path}: invalid JSON") from exc
    if not isinstance(data, dict):
        raise ValueError(f"{path}: expected JSON object")
    if path.endswith("trades_public.json") or path.endswith("trades-recent.json"):
        trades = data.get("trades")
        if not isinstance(trades, list):
            raise ValueError(f"{path}: missing trades array")
        for index, trade in enumerate(trades):
            if not isinstance(trade, dict):
                raise ValueError(f"{path}: trade {index} must be an object")
    else:
        collectors = data.get("collectors")
        if not isinstance(collectors, dict):
            raise ValueError(f"{path}: missing collectors object")
        for name, status in collectors.items():
            if not isinstance(status, dict):
                raise ValueError(f"{path}: collector {name} must be an object")
            count = status.get("count")
            if type(count) is not int or count < 0:
                raise ValueError(f"{path}: collector {name} has invalid count")
            errors = status.get("errors")
            if not isinstance(errors, list) or any(not isinstance(error, str) for error in errors):
                raise ValueError(f"{path}: collector {name} has invalid errors list")


def check_public_json(site_url, expected_dir, opener=urlopen, sleeper=time.sleep, attempts=4):
    parsed = urlsplit(site_url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.query or parsed.fragment or parsed.username or parsed.password:
        raise ValueError("site-url must be a plain HTTPS Pages URL without credentials, query or fragment")
    base = site_url.rstrip("/") + "/"
    root = Path(expected_dir)
    if attempts < 1:
        raise ValueError("attempts must be >= 1")
    for path in PUBLIC_JSON_PATHS:
        expected = (root / path).read_bytes()
        validate_json(path, expected)
        expected_sha = hashlib.sha256(expected).hexdigest()
        url = base + path
        last_error = None
        for attempt in range(attempts):
            try:
                request = Request(url, headers={"Cache-Control": "no-cache", "Accept-Encoding": "identity", "User-Agent": "money-tracker-pages-json-audit/1.0"})
                with opener(request, timeout=25) as response:
                    # urllib follows redirects by default. A 200 from another
                    # path or host does not prove this Pages URL was published.
                    geturl = getattr(response, "geturl", None)
                    if callable(geturl) and geturl() != url:
                        raise ValueError("unexpected redirect target (not the requested Pages JSON URL)")
                    if response.status != 200:
                        raise ValueError(f"HTTP {response.status}")
                    actual = response.read(MAX_BYTES + 1)
                validate_json(path, actual)
                actual_sha = hashlib.sha256(actual).hexdigest()
                if actual_sha != expected_sha:
                    raise ValueError(f"SHA-256 mismatch expected={expected_sha[:16]} actual={actual_sha[:16]}")
                print(f"PASS {path} SHA-256 {expected_sha[:16]}")
                break
            except (OSError, ValueError) as exc:
                last_error = exc
                if attempt + 1 < attempts:
                    sleeper(min(3 * (attempt + 1), 9))
        else:
            raise RuntimeError(f"FAIL {path}: {last_error}") from last_error
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-url", required=True, help="HTTPS URL of deployed Pages site")
    parser.add_argument("--expected-dir", default=".public-pages", help="public-only artifact built from the deployed SHA")
    args = parser.parse_args()
    try:
        check_public_json(args.site_url, args.expected_dir)
    except (OSError, ValueError, RuntimeError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
