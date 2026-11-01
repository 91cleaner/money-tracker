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


def invalid_rows(payload, *, today=None):
    """Return (zero-based index, reason) for unsafe rows; malformed snapshots fail.

    Reject future-dated snapshots against UTC today. `today` permits stable tests.
    """
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
    if today is None:
        today = dt.datetime.now(dt.timezone.utc).date()
    if not isinstance(today, dt.date) or isinstance(today, dt.datetime):
        raise ValueError("today must be a calendar date")
    if updated > today:
        raise ValueError("House PTR snapshot updated date is in the future (UTC)")
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


# The older Pages artifact check verified only public field *names*.
# A permitted field containing a nested object could still expose private data.
PUBLIC_TRADE_FIELDS = {
    "id", "who", "c", "tk", "asset", "ty", "d", "fd", "filed",
    "amt", "doc", "r", "rspy", "party", "state",
}


def validate_public_trades(payload):
    """Fail closed if the public trade summary contains hidden nested metadata."""
    import math

    if not isinstance(payload, dict):
        raise ValueError("public trades must be an object")
    extra = set(payload) - {"updated", "source", "note", "trades"}
    if extra:
        raise ValueError(f"non-public top-level fields: {sorted(extra)}")
    for key in ("updated", "source", "note"):
        value = payload.get(key)
        if value is not None and (
            not isinstance(value, str) or len(value) > 2000
            or re.search(r"[<>\x00-\x1f\x7f]", value)
        ):
            raise ValueError(f"unsafe public metadata: {key}")
    rows = payload.get("trades")
    if not isinstance(rows, list) or not rows:
        raise ValueError("public trades must contain a nonempty list")
    for i, row in enumerate(rows):
        if not isinstance(row, dict):
            raise ValueError(f"public trade row {i} is not an object")
        extra = set(row) - PUBLIC_TRADE_FIELDS
        if extra:
            raise ValueError(f"non-public trade row {i} fields: {sorted(extra)}")
        for key, value in row.items():
            if isinstance(value, bool) or not isinstance(value, (str, int, float)):
                raise ValueError(f"unsafe public trade row {i} field: {key}")
            if isinstance(value, str):
                if len(value) > 2000 or re.search(r"[<>\x00-\x1f\x7f]", value):
                    raise ValueError(f"unsafe public trade row {i} field: {key}")
            elif not math.isfinite(value):
                raise ValueError(f"non-finite public trade row {i} field: {key}")


def invalid_public_trade_rows(payload, *, today=None):
    """Find impossible chronology/unsafe official links in the full public summary.

    The schema check is separate so the public *copy* can quarantine bad rows
    without changing collector-owned source records.
    """
    validate_public_trades(payload)
    if today is None:
        today = dt.datetime.now(dt.timezone.utc).date()
    if not isinstance(today, dt.date) or isinstance(today, dt.datetime):
        raise ValueError("today must be a calendar date")
    stamp = payload.get("updated")
    if not isinstance(stamp, str) or not re.fullmatch(
            r"\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2} UTC)?", stamp):
        raise ValueError("public summary updated must be UTC date or timestamp")
    # Validate clock bounds explicitly. Do not rely on datetime's parser:
    # some runtime versions accept 24:00 as an end-of-day representation,
    # while the public snapshot contract requires hours 00..23.
    if len(stamp) > 10:
        hour = int(stamp[11:13])
        minute = int(stamp[14:16])
        if hour > 23 or minute > 59:
            raise ValueError("public summary updated contains invalid UTC clock time")
    updated = _date(stamp[:10])
    if updated > today:
        raise ValueError("public summary updated date is in the future (UTC)")
    bad = []
    for i, row in enumerate(payload["trades"]):
        try:
            traded = _date(row.get("d"))
            disclosed = _date(row.get("fd"))
            filed = _date(row.get("filed"))
            if not traded <= disclosed <= filed <= updated:
                raise ValueError("requires trade <= disclosure <= filed <= snapshot")
            document = row.get("doc")
            match = OFFICIAL_PDF.fullmatch(document) if isinstance(document, str) else None
            if not match:
                raise ValueError("missing or nonofficial House Clerk PDF URL")
            if int(match.group(1)) != filed.year:
                raise ValueError("House Clerk PDF archive year does not match filing year")
        except (TypeError, ValueError) as exc:
            bad.append((i, str(exc)))
    return bad


def sanitize_public_trades_file(path):
    """Remove unsafe public summary rows in generated Pages copy only."""
    path = Path(path)
    payload = json.loads(path.read_text(encoding="utf-8"))
    bad = invalid_public_trade_rows(payload)
    if bad:
        total = len(payload["trades"])
        if len(bad) == total:
            raise ValueError("All public summary trade rows invalid; refusing release")
        # Quarantine isolated bad filings, but do not silently publish a nearly
        # empty ledger when a collector/schema regression invalidates most rows.
        # Keep at least 25% of the input records or fail before writing.
        if len(bad) * 4 > total * 3:
            raise ValueError(
                f"Public summary integrity collapse: {len(bad)}/{total} rows invalid; refusing release"
            )
        exclude = {i for i, _ in bad}
        payload["trades"] = [r for i, r in enumerate(payload["trades"])
                             if i not in exclude]
        payload["note"] = (str(payload.get("note") or "") +
                           f" Public chronology/official-source guard excluded {len(bad)} rows.").strip()
        validate_public_trades(payload)
        if invalid_public_trade_rows(payload):
            raise ValueError("Public trade summary still contains invalid rows")
        path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
        for i, reason in bad:
            print(f"WARNING: public summary row {i} excluded: {reason}", file=sys.stderr)
    return len(payload["trades"]), len(bad)


def sanitize_file(path):
    """Quarantine invalid rows in the PUBLIC COPY; refuse to publish all-invalid data."""
    path = Path(path)
    payload = json.loads(path.read_text(encoding="utf-8"))
    bad = invalid_rows(payload)
    if bad:
        if len(bad) == len(payload["trades"]):
            raise ValueError("All House PTR rows invalid; refusing empty public snapshot")
        # Match the full-summary integrity gate: a partial public snapshot must
        # not silently discard over three quarters of its source records.
        total = len(payload["trades"])
        if len(bad) * 4 > total * 3:
            raise ValueError(
                f"House PTR snapshot integrity collapse: {len(bad)}/{total} rows invalid; refusing release"
            )
        exclude = {i for i, _ in bad}
        payload["trades"] = [r for i, r in enumerate(payload["trades"]) if i not in exclude]
        payload["note"] = (str(payload.get("note") or "") +
                           f" 공개 전 날짜·공식 원문·공개 필드 검증 불일치 {len(bad)}건 제외.").strip()
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        for i, reason in bad:
            print(f"WARNING: public House PTR row {i} excluded: {reason}", file=sys.stderr)
    return len(payload["trades"]), len(bad)
