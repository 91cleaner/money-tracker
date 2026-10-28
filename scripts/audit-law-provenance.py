#!/usr/bin/env python3
"""Read-only quality audit for MONEY TRACKER's five regional law corpora.

Does not collect, mutate or infer law status. A passed status without a
verified action date is *not* a market event. Warnings remain visible in
GitHub Actions, while malformed/missing source files fail the audit.
"""
import argparse
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

REGIONS = ("kr", "us", "jp", "tw", "eu")
ROOT = Path(__file__).resolve().parents[1]


def iso_day(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def https_url(value):
    if not isinstance(value, str):
        return False
    try:
        p = urlsplit(value)
        return p.scheme == "https" and bool(p.hostname) and not p.username and not p.password
    except ValueError:  # malformed IPv6 brackets/ports are bad source links, not fatal audit errors
        return False


def enacted_status(cc, row):
    status = str(row.get("st") or "")
    return (
        (cc == "kr" and "가결" in status)
        or (cc == "jp" and "成立" in status)
        or (cc == "tw" and "三讀" in status)
        or (cc == "us" and bool(re.search(r"Became Public Law|Signed by President", status, re.I)))
    )


def enacted_without_action_date(cc, row):
    return enacted_status(cc, row) and not iso_day(row.get("sd"))


def audit_document(cc, doc, today=None):
    today = today or date.today()
    if not isinstance(doc, dict) or not isinstance(doc.get("rows"), list):
        raise ValueError(f"{cc}: missing rows array")
    rows = doc["rows"]
    counts = {"rows": len(rows), "duplicate_id": 0, "missing_title": 0,
              "bad_url": 0, "bad_introduction_date": 0, "bad_action_date": 0,
              "future_introduction_date": 0, "future_action_date": 0,
              "action_before_introduction": 0, "enacted_action_date_missing": 0,
              "enacted_action_date_invalid": 0}
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError(f"{cc}: row is not an object")
        ident = str(row.get("id") or "")
        if not ident or ident in seen:
            counts["duplicate_id"] += 1
        seen.add(ident)
        if not str(row.get("t") or "").strip():
            counts["missing_title"] += 1
        if not https_url(row.get("u")):
            counts["bad_url"] += 1
        introduced = iso_day(row.get("d"))
        if row.get("d") and not introduced:
            counts["bad_introduction_date"] += 1
        if introduced and introduced > today:
            counts["future_introduction_date"] += 1
        action = iso_day(row.get("sd"))
        if row.get("sd") and not action:
            counts["bad_action_date"] += 1
        if action and action > today:
            counts["future_action_date"] += 1
        if action and introduced and action < introduced:
            counts["action_before_introduction"] += 1
        if enacted_without_action_date(cc, row):
            counts["enacted_action_date_missing"] += 1
        # An existing date is not necessarily a usable historical market event.
        # Keep this separate from missing dates to avoid inventing an event day.
        if (enacted_status(cc, row) and action and
                (action > today or (introduced and action < introduced))):
            counts["enacted_action_date_invalid"] += 1
    counts["count_mismatch"] = int(doc.get("count") != len(rows))
    counts["missing_corpus_source"] = int(not https_url(doc.get("source_url")))
    return counts


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", type=Path, default=ROOT)
    args = ap.parse_args()
    summary = {}
    failed = False
    for cc in REGIONS:
        path = args.root / "data" / "laws" / f"{cc}.json"
        try:
            with path.open(encoding="utf-8") as f:
                summary[cc] = audit_document(cc, json.load(f))
        except (OSError, ValueError, json.JSONDecodeError) as e:
            print(f"::error::{cc} corpus unavailable or invalid: {e}")
            failed = True
            continue
        c = summary[cc]
        print(f"::notice::law provenance {cc}: rows={c['rows']} missing_enactment_date={c['enacted_action_date_missing']} bad_url={c['bad_url']} duplicates={c['duplicate_id']}")
        warnings = {k: v for k, v in c.items() if k != "rows" and v}
        if warnings:
            print(f"::warning::law provenance {cc}: {json.dumps(warnings, ensure_ascii=False, sort_keys=True)}")
    print(json.dumps({"regions": summary, "audit_failed": failed}, ensure_ascii=False, sort_keys=True))
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
