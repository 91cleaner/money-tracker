#!/usr/bin/env python3
"""Read-only Pages probe: fail if files excluded from the public artifact are live.

Only HTTP status codes and paths are reported; response bodies are never logged.
This does NOT protect files in a public GitHub repository.
"""
import argparse
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

DEFAULT_BASE = "https://91cleaner.github.io/money-tracker/"
BLOCKED = (
    "data/us/house-ptr-candidates.json",
    "data/us/ptr-crosschecks.json",
    "worker/private-api.js",
    "cloudflare/admin-worker.js",
    "wrangler.jsonc",
    ".github/workflows/deploy-pages.yml",
    "collector/collect.py",
    # Canary paths that must exist in the source tree but never in curated Pages.
    "server/worker.mjs",
    "wrangler.toml",
    "HANDOFF.md",
    "docs/AI-ROLES.md",
)


def status_for(base, path, opener=urlopen):
    url = urljoin(base, path)
    expected = urlsplit(base)
    for method in ("HEAD", "GET"):
        req = Request(url, method=method, headers={
            "User-Agent": "money-tracker-pages-exposure-audit/1.0",
            **({"Range": "bytes=0-0"} if method == "GET" else {}),
        })
        try:
            with opener(req, timeout=12) as response:
                final = urlsplit(response.geturl())
                if (final.scheme, final.netloc) != (expected.scheme, expected.netloc):
                    raise RuntimeError(f"unexpected redirect for {path}")
                return response.status
        except HTTPError as exc:
            if exc.code == 405 and method == "HEAD":
                continue
            return exc.code
        except (URLError, TimeoutError, OSError) as exc:
            raise RuntimeError(f"network check failed for {path}: {type(exc).__name__}") from exc
    raise RuntimeError(f"HTTP methods rejected for {path}")


def audit(base, probe=status_for):
    if not base.endswith("/") or urlsplit(base).scheme != "https":
        raise ValueError("base URL must be an HTTPS directory ending in /")
    home = probe(base, "index.html")
    if home != 200:
        raise RuntimeError(f"site entry point unavailable: HTTP {home}")
    results = {}
    for path in BLOCKED:
        status = probe(base, path)
        results[path] = status
    exposed = [path for path, status in results.items() if status in (200, 206) or 300 <= status < 400]
    unknown = [path for path, status in results.items() if status not in (404, 410, 200, 206) and not 300 <= status < 400]
    return results, exposed, unknown


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=DEFAULT_BASE)
    args = parser.parse_args(argv)
    try:
        results, exposed, unknown = audit(args.base_url)
    except (ValueError, RuntimeError) as exc:
        print(f"::error title=Pages exposure audit::{exc}", file=sys.stderr)
        return 1
    for path, status in results.items():
        print(f"HTTP {status} {path}")
    if exposed:
        print("::error title=Pages files exposed::Forbidden public URLs: " + ", ".join(exposed), file=sys.stderr)
    if unknown:
        print("::error title=Pages exposure inconclusive::Unexpected HTTP status for: " + ", ".join(unknown), file=sys.stderr)
    if exposed or unknown:
        return 1
    print("PASS: no forbidden paths served by live Pages (public repository contents remain public).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
