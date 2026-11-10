#!/usr/bin/env python3
"""Fail closed if GitHub Pages is not configured to use Actions deployments.

GitHub's legacy branch publisher races with deploy-pages.yml and can publish
unfiltered repository files. Run this before trusting the public artifact gate.
"""
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

API_VERSION = "2022-11-28"


def check_pages_source(payload):
    if not isinstance(payload, dict):
        raise ValueError("Pages settings response must be a JSON object")
    build_type = payload.get("build_type")
    if build_type != "workflow":
        raise ValueError(
            "UNSAFE GitHub Pages Source: expected GitHub Actions (build_type=workflow), "
            f"got {build_type!r}. In Settings > Pages > Build and deployment, "
            "set Source to GitHub Actions. Legacy branch publishing can bypass "
            "scripts/prepare-public-pages.py and expose files excluded from the artifact."
        )
    return "PASS: GitHub Pages Source is GitHub Actions."


def fetch_pages_settings(repo, token):
    if not repo or "/" not in repo or not token:
        raise ValueError("GITHUB_REPOSITORY and GITHUB_TOKEN are required")
    req = Request(
        f"https://api.github.com/repos/{repo}/pages",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": API_VERSION,
            "User-Agent": "money-tracker-pages-source-guard",
        },
    )
    with urlopen(req, timeout=20) as response:
        return json.load(response)


def main():
    try:
        if "--stdin" in sys.argv[1:]:
            payload = json.load(sys.stdin)
        else:
            payload = fetch_pages_settings(
                os.environ.get("GITHUB_REPOSITORY"), os.environ.get("GITHUB_TOKEN")
            )
        print(check_pages_source(payload))
        return 0
    except (ValueError, HTTPError, URLError, OSError, json.JSONDecodeError) as exc:
        print(f"::error title=Pages source guard::{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
