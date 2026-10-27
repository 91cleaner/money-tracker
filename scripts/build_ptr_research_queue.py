#!/usr/bin/env python3
"""Build the House PTR PDF review queue from official filing metadata.

Filings are not verified securities transactions. Sort actual calendar dates,
not lexicographic M/D/YYYY strings from the House Clerk index.
"""
import datetime as dt
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/us-house-filings.json"
OUT = ROOT / "data/us-ptr-research-queue.json"
PTR_URL = re.compile(r"https://disclosures-clerk\.house\.gov/public_disc/ptr-pdfs/\d{4}/\d+\.pdf")


def filing_date(value):
    if not isinstance(value, str):
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            pass
    return None


def build_queue(payload, limit=250):
    rows = payload.get("records", [])
    if not isinstance(rows, list):
        raise ValueError("records is not a list")
    selected = []
    for row in rows:
        if not isinstance(row, dict) or str(row.get("filing_type", "")).upper() != "P":
            continue
        url = row.get("document_url")
        date = filing_date(row.get("filing_date"))
        member = str(row.get("member") or "").strip()
        filing_id = str(row.get("id") or "").strip()
        if not isinstance(url, str) or not PTR_URL.fullmatch(url):
            continue
        if not date or not member or not filing_id:
            continue  # Unattributable or undated filings are not valid review evidence.
        selected.append({
            "id": filing_id, "member": member,
            "filing_date": row["filing_date"], "document_url": url,
            "status": "awaiting_pdf_review",
        })
    selected.sort(key=lambda row: (filing_date(row["filing_date"]), row["id"]), reverse=True)
    unique = []
    seen_urls = set()
    for row in selected:
        if row["document_url"] not in seen_urls:
            seen_urls.add(row["document_url"])
            unique.append(row)
    return {
        "schema_version": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "source": "US House Clerk filing index",
        "source_collected_at": payload.get("collected_at"),
        "count": len(unique),
        "records": unique[:limit],
        "caveat": "A PTR filing is not a verified transaction. PDF contents and trade dates require separate review.",
    }


def main():
    if not SOURCE.exists() or SOURCE.stat().st_size == 0:
        print("House index unavailable; PTR research queue not generated")
        return
    try:
        payload = json.loads(SOURCE.read_text(encoding="utf-8"))
        report = build_queue(payload)
        OUT.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print("PTR filing research queue:", len(report["records"]))
    except (OSError, ValueError, TypeError) as exc:
        raise SystemExit("Invalid House index: " + str(exc))


if __name__ == "__main__":
    main()
