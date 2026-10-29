#!/usr/bin/env python3
"""Fail closed if a prepared Pages artifact contains source/private paths.

Complements check-pages-artifact.py's required-file checks. This scans *all*
paths, rather than checking only a short list of known forbidden filenames.
It cannot protect legacy branch-based Pages deployment or a public repository.
"""
import argparse
import re
from pathlib import Path

PUBLIC_DIRS = {
    "assets", "data", "c", "s", "world-intelligence",
    "3ac9ae3", "9590438", "b387449",
}
PUBLIC_EXTENSIONS = {
    ".html", ".css", ".js", ".json", ".geojson", ".csv",
    ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico",
    ".webmanifest", ".txt",
}
EXCLUDED_PARTS = {"__pycache__", ".git", "private", "internal", "secrets", "credentials", "debug"}
BLOCKED_NAMES = {".env", "wrangler.jsonc", "wrangler.toml"}
BLOCKED_SUFFIXES = {".pem", ".key", ".p12", ".sqlite", ".db"}
PRIVATE_DATA_FILES = {
    "data/us/trades.json",
    "data/us/house-ptr-candidates.json",
    "data/us/ptr-crosschecks.json",
    "data/us-ptr-research-queue.json",
    "data/us-ptr-extraction-status.json",
}
# Explicitly keep GitHub and deployment/source configuration out of the site.
SOURCE_NAMES = {
    "package.json", "package-lock.json", "pyproject.toml",
    "requirements.txt", "Dockerfile", "Makefile",
}
# New review-only data must not become public merely because it is JSON.
# Check directory components as well as filenames (e.g. data/us/research/records.json).
# Token boundaries avoid blocking unrelated symbols such as "JQA21112".
REVIEW_ONLY_TOKENS = {
    "private", "internal", "secret", "secrets", "credential", "credentials",
    "review", "reviews", "research", "queue", "queues", "candidate",
    "candidates", "crosscheck", "crosschecks", "extraction", "unverified",
    "draft", "drafts", "pending",
    "token", "tokens", "oauth", "jwt", "apikey", "apikeys", "key", "keys",
    "password", "passwords", "session", "sessions",
    "backup", "backups", "staging",
}


def review_only_data(rel: Path):
    if rel.parts[0] != "data":
        return False
    tokens = set(re.split(r"[^a-z0-9]+", rel.as_posix().lower()))
    return bool(tokens & REVIEW_ONLY_TOKENS)


def violations(root: Path):
    if root.is_symlink() or not root.is_dir():
        return ["artifact directory missing or is a symlink"]
    failures = []
    for path in root.rglob("*"):
        rel = path.relative_to(root)
        name = rel.as_posix()
        parts = rel.parts
        if path.is_symlink():
            failures.append(f"{name}: symlink")
            continue
        if not path.is_file() and not path.is_dir():
            failures.append(f"{name}: unsupported filesystem entry")
            continue
        if name == ".nojekyll" and path.is_file():
            continue
        if any(part.startswith(".") or part.lower() in EXCLUDED_PARTS for part in parts):
            failures.append(f"{name}: hidden or excluded path")
            continue
        if len(parts) > 1 and parts[0] not in PUBLIC_DIRS:
            failures.append(f"{name}: unexpected top-level directory")
            continue
        if parts[-1].lower() in BLOCKED_NAMES | SOURCE_NAMES:
            failures.append(f"{name}: blocked source/config filename")
            continue
        if path.is_dir():
            continue
        if name in PRIVATE_DATA_FILES or review_only_data(rel):
            failures.append(f"{name}: private or review-only dataset")
        elif path.suffix.lower() in BLOCKED_SUFFIXES or path.suffix.lower() not in PUBLIC_EXTENSIONS:
            failures.append(f"{name}: non-public file extension")
    return failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact", nargs="?", type=Path, default=Path(".public-pages"))
    args = parser.parse_args()
    errors = violations(args.artifact)
    for error in errors:
        print("::error::Pages artifact policy: " + error)
    if errors:
        print(f"FAIL: {len(errors)} disallowed artifact path(s)")
        return 1
    print("PASS: Pages artifact contains no disallowed paths")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
