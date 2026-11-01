#!/usr/bin/env python3
"""Fail closed if deployed public JSON differs from the release artifact.

This checks exact published bytes, not the accuracy of the underlying filings.
Run after the Pages deploy, using the same commit SHA that produced the artifact.
"""
import argparse
import hashlib
import json
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


def validate_json(path, body):
    if len(body) > MAX_BYTES:
        raise ValueError(f"{path}: JSON exceeds {MAX_BYTES} bytes")
    try:
        data = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"{path}: invalid JSON") from exc
    if not isinstance(data, dict):
        raise ValueError(f"{path}: expected JSON object")
    if path.endswith("trades_public.json") or path.endswith("trades-recent.json"):
        if not isinstance(data.get("trades"), list):
            raise ValueError(f"{path}: missing trades array")
    elif not isinstance(data.get("collectors"), dict):
        raise ValueError(f"{path}: missing collectors object")


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
