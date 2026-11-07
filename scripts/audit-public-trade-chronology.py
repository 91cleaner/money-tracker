#!/usr/bin/env python3
"""Summarize all public PTR chronology anomalies without echoing untrusted data.

Read-only companion to check-pages-artifact.py. This diagnostic does not
repair, exclude, or reinterpret any official filing. The release gate remains
authoritative; the audit helps the data owner resolve all failures at once.
"""
from collections import defaultdict
from datetime import date, datetime, timezone
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

DATE_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}\Z")
HOUSE_PATH = re.compile(r"/public_disc/ptr-pdfs/([0-9]{4})/[A-Za-z0-9_-]+\.pdf\Z", re.I)


def calendar_day(value):
    if not isinstance(value, str) or not DATE_RE.fullmatch(value):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def audit_rows(rows, today):
    """Return reason -> zero-based row indices; never retain untrusted text."""
    problems = defaultdict(list)
    for index, row in enumerate(rows):
        reasons = set()
        if not isinstance(row, dict):
            problems["invalid-row"].append(index)
            continue
        trade = calendar_day(row.get("d"))
        if trade is None:
            reasons.add("invalid-transaction-date")
        elif trade > today:
            reasons.add("future-transaction-date")
        for field, label in (("fd", "filing"), ("filed", "submission")):
            if field not in row:
                continue
            day = calendar_day(row[field])
            if day is None:
                reasons.add("invalid-" + label + "-date")
            else:
                if trade is not None and day < trade:
                    reasons.add(label + "-predates-transaction")
                if day > today:
                    reasons.add("future-" + label + "-date")
        doc = row.get("doc")
        if not isinstance(doc, str):
            reasons.add("invalid-filing-url")
        elif ("\\" in doc
              or any(ch.isspace() or ord(ch) < 32 or ord(ch) == 127 for ch in doc)
              or any(ch in doc for ch in ('"', "'", "<", ">", "`"))):
            # urlsplit silently strips leading C0 controls and embedded tabs.
            # Match the public release gate before parsing the filing URL.
            reasons.add("invalid-filing-url")
        else:
            try:
                url = urlsplit(doc)
                if url.scheme != "https" or url.username is not None or url.password is not None:
                    reasons.add("invalid-filing-url")
                elif url.hostname == "disclosures-clerk.house.gov":
                    match = HOUSE_PATH.fullmatch(url.path)
                    if not match or url.query or url.fragment or url.port not in (None, 443):
                        reasons.add("invalid-filing-url")
                    else:
                        archive_year = int(match.group(1))
                        if archive_year > today.year:
                            reasons.add("future-filing-archive")
                        if trade is not None and archive_year < trade.year:
                            reasons.add("archive-predates-transaction")
                elif url.hostname == "efdsearch.senate.gov":
                    if (not re.fullmatch(r"/search/view/ptr/[A-Za-z0-9_-]+/?", url.path)
                            or url.query or url.fragment or url.port not in (None, 443)):
                        reasons.add("invalid-filing-url")
                else:
                    reasons.add("invalid-filing-url")
            except ValueError:
                reasons.add("invalid-filing-url")
        for reason in sorted(reasons):
            problems[reason].append(index)
    return dict(problems)


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if len(args) > 1:
        print("Usage: audit-public-trade-chronology.py [public-trades-json]", file=sys.stderr)
        return 2
    path = Path(args[0] if args else ".public-pages/data/us/trades_public.json")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict) or not isinstance(payload.get("trades"), list):
            raise ValueError("invalid public ledger")
    except (OSError, UnicodeError, ValueError, TypeError):
        # Never echo file contents, paths or parser exception fragments.
        print("Public PTR audit unavailable: invalid or missing ledger", file=sys.stderr)
        return 2
    rows = payload["trades"]
    problems = audit_rows(rows, datetime.now(timezone.utc).date())
    print(f"Public PTR chronology audit: {len(rows)} rows, {len(set(i for ids in problems.values() for i in ids))} anomalous rows")
    for reason, indices in sorted(problems.items()):
        preview = ",".join(str(i) for i in indices[:12])
        suffix = ",..." if len(indices) > 12 else ""
        print(f"  {reason}: {len(indices)} (zero-based rows: {preview}{suffix})")
    if problems:
        print("Review official filing originals; no dates were modified.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
