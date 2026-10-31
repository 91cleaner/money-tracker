#!/usr/bin/env python3
"""Fail closed on invalid public House PTR chronology and official-source links.

This operates on the generated Pages copy, never the collector's source ledger.
"""
import datetime as dt
import json
import re
import sys
from pathlib import Path

OFFICIAL_PDF = re.compile(
    r"https://disclosures-clerk\.house\.gov/public_disc/ptr-pdfs/(\d{4})/\d+\.pdf"
)


# A valid date and official PDF link do not make arbitrary collector fields public.
# Keep this contract deliberately narrower than the private trade ledger.
PUBLIC_TOP_FIELDS = {"updated", "note", "trades"}
PUBLIC_ROW_FIELDS = {"tk", "who", "ty", "amt", "d", "fd", "doc"}
PUBLIC_TEXT_LIMITS = {"tk": 32, "who": 160, "ty": 32, "amt": 100}


def _date(value):
    # date.fromisoformat also accepts compact (YYYYMMDD) and ISO week dates;
    # public PTR JSON requires one unambiguous calendar-date representation.
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("date must be YYYY-MM-DD")
    return dt.date.fromisoformat(value)


def _public_text(value, field, limit):
    """Reject nested metadata, HTML markup and control chars in public text."""
    if (not isinstance(value, str) or not value.strip() or len(value) > limit
            or re.search(r"[<>\x00-\x1f\x7f]", value)):
        raise ValueError(f"unsafe public text field: {field}")


def invalid_rows(payload):
    """Return (zero-based index, reason) for unsafe rows; malformed snapshots fail."""
    if not isinstance(payload, dict):
        raise ValueError("House PTR snapshot must be a JSON object")
    unexpected = set(payload) - PUBLIC_TOP_FIELDS
    if unexpected:
        raise ValueError(f"Non-public House PTR snapshot fields: {sorted(unexpected)}")
    if "note" in payload:
        if not isinstance(payload["note"], str):
            raise ValueError("House PTR note must be text")
        if payload["note"]:
            _public_text(payload["note"], "note", 2000)
    updated = _date(payload.get("updated"))
    rows = payload.get("trades")
    if not isinstance(rows, list) or not rows:
        raise ValueError("House PTR snapshot must contain nonempty trades")
    bad = []
    for i, row in enumerate(rows):
        try:
            if not isinstance(row, dict):
                raise ValueError("row is not an object")
            unexpected = set(row) - PUBLIC_ROW_FIELDS
            if unexpected:
                raise ValueError(f"Non-public House PTR row fields: {sorted(unexpected)}")
            for field, limit in PUBLIC_TEXT_LIMITS.items():
                if field in row or field in ("who", "tk"):
                    _public_text(row.get(field), field, limit)
            traded, filed = _date(row.get("d")), _date(row.get("fd"))
            if not traded <= filed <= updated:
                raise ValueError("requires transaction <= filing <= snapshot date")
            document = row.get("doc")
            match = OFFICIAL_PDF.fullmatch(document) if isinstance(document, str) else None
            if not match:
                raise ValueError("missing or nonofficial House Clerk PDF URL")
            if int(match.group(1)) != filed.year:
                raise ValueError("House Clerk PDF archive year does not match filing year")
        except (TypeError, ValueError) as exc:
            bad.append((i, str(exc)))
    return bad


def sanitize_file(path):
    """Quarantine invalid rows in the PUBLIC COPY; refuse to publish all-invalid data."""
    path = Path(path)
    payload = json.loads(path.read_text(encoding="utf-8"))
    bad = invalid_rows(payload)
    if bad:
        if len(bad) == len(payload["trades"]):
            raise ValueError("All House PTR rows invalid; refusing empty public snapshot")
        exclude = {i for i, _ in bad}
        payload["trades"] = [r for i, r in enumerate(payload["trades"]) if i not in exclude]
        payload["note"] = (str(payload.get("note") or "") +
                           f" 공개 전 날짜·공식 PDF URL 형식 검증 불일치 {len(bad)}건 제외.").strip()
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        for i, reason in bad:
            print(f"WARNING: public House PTR row {i} excluded: {reason}", file=sys.stderr)
    return len(payload["trades"]), len(bad)
