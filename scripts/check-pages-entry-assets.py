#!/usr/bin/env python3
"""Fail CI when key published pages refer to missing local static assets.

Only checks static HTML script/link/img URLs, not runtime fetch() paths.
Run after scripts/prepare-public-pages.py; no network or credentials needed.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import sys

ENTRY_PAGES = (
    "index.html", "search.html", "national.html",
    "usa-command.html", "usa-command-legacy.html",
    "world-intelligence/index.html", "company.html", "member.html",
    "bill.html", "sector.html",
)
LINK_RELS = {"stylesheet", "icon", "apple-touch-icon", "manifest", "preload", "modulepreload"}


class AssetReferences(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.urls = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "img") and attrs.get("src"):
            self.urls.append(attrs["src"])
        elif tag == "link" and attrs.get("href"):
            rels = set((attrs.get("rel") or "").lower().split())
            if rels & LINK_RELS:
                self.urls.append(attrs["href"])


def find_missing(root, entry_pages=ENTRY_PAGES):
    root = Path(root).resolve()
    errors = []
    for entry in entry_pages:
        page = root / entry
        if not page.is_file():
            errors.append(f"{entry}: missing entry page")
            continue
        parser = AssetReferences()
        parser.feed(page.read_text(encoding="utf-8"))
        for url in parser.urls:
            try:
                parts = urlsplit(url.strip())
            except ValueError:
                errors.append(f"{entry}: malformed URL {url!r}")
                continue
            if parts.scheme or parts.netloc or not parts.path:
                continue  # CDN, data URI, or fragment
            rel = unquote(parts.path)
            if rel.startswith("/money-tracker/"):
                target = root / rel[len("/money-tracker/"):]
            elif rel.startswith("/"):
                target = root / rel.lstrip("/")
            else:
                target = page.parent / rel
            target = target.resolve()
            if not target.is_relative_to(root):
                errors.append(f"{entry}: path escapes public artifact: {url}")
            elif not target.is_file():
                errors.append(f"{entry}: missing linked asset: {url}")
    return errors


if __name__ == "__main__":
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".public-pages")
    errors = find_missing(root)
    if errors:
        for error in errors:
            print("ERROR:", error, file=sys.stderr)
        sys.exit(f"Pages entry asset audit failed ({len(errors)} missing/invalid references)")
    print(f"Pages entry asset audit PASS: {len(ENTRY_PAGES)} entry pages")
